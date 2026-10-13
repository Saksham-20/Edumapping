const { User, Organization, RecruiterProfile, Job, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const {
  canDecideOrganization,
  canDecideUser,
  cascadeOrganizationDecision,
  STAFF_ROLES_BY_ORG_TYPE
} = require('../utils/approvalCascade');

// The approval queue is shared by two kinds of reviewer with different reach:
//
//   * a TPO vets companies and their recruiters — the outsiders asking to
//     recruit from campus;
//   * an administrator vets everything, including new institutions and the
//     TPOs and school staff who registered them.
//
// Every list here is scoped by `scopeFor(req.user)` so the two never see each
// other's queue, and every write re-checks with `canDecide*` because a list
// filter is not an authorisation check.

const ORG_TYPES = ['university', 'college', 'school', 'company'];
const USER_ROLES = [
  'student', 'recruiter', 'tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'
];
// 'stuck' is not a stored status: it is an account marked approved that still
// cannot sign in, which is what the old static-update approval path produced.
const LIST_STATUSES = ['pending', 'approved', 'rejected', 'stuck'];

const PAST_TENSE = { approve: 'approved', reject: 'rejected' };

const pageParams = (query, fallback = 20) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || fallback, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

const pagination = (page, limit, count) => ({
  currentPage: page,
  totalPages: Math.max(Math.ceil(count / limit), 1),
  totalItems: count,
  itemsPerPage: limit
});

const userStatusWhere = (status) => {
  if (status === 'stuck') return { approvalStatus: 'approved', isActive: false };
  return { approvalStatus: status };
};

const badRequest = (res, errors) =>
  res.status(400).json({
    error: 'Validation Error',
    message: errors.array()[0]?.msg || 'Invalid request',
    details: errors.array()
  });

/** Fire-and-forget: an audit write must never fail the decision it records. */
const audit = (req, action, entityType, entityId, newValues) =>
  AuditLog.create({
    userId: req.user.id,
    action,
    entityType,
    entityId,
    newValues,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  }).catch((err) => logger.error('Audit log failed', err));

class ApprovalController {
  /**
   * Headline queue for the signed-in reviewer: what is waiting, unpaginated
   * counts plus the first page of each list. Kept for existing callers; the
   * paginated lists below are what the approval screen pages through.
   */
  async getPendingApprovals(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && !req.user.organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      const orgWhere = { approvalStatus: 'pending', ...(isAdmin ? {} : { type: 'company' }) };
      const userWhere = { approvalStatus: 'pending', ...(isAdmin ? { role: { [Op.ne]: 'admin' } } : { role: 'recruiter' }) };

      const [pendingOrganizations, pendingUsers] = await Promise.all([
        Organization.findAll({
          where: orgWhere,
          include: [
            {
              model: User,
              as: 'users',
              attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt'],
              required: false
            }
          ],
          order: [['createdAt', 'ASC']],
          limit: 100
        }),
        User.findAll({
          where: userWhere,
          // Never ship the bcrypt hash to a client just because the default
          // scope selects every column.
          attributes: { exclude: ['passwordHash'] },
          include: [
            { model: Organization, as: 'organization', attributes: ['id', 'name', 'type', 'logoUrl'] },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['position', 'department', 'experience']
            }
          ],
          order: [['createdAt', 'ASC']],
          limit: 100
        })
      ]);

      res.json({
        message: 'Pending approvals retrieved successfully',
        data: {
          organizations: pendingOrganizations,
          recruiters: pendingUsers.filter((u) => u.role === 'recruiter'),
          users: pendingUsers,
          total: pendingOrganizations.length + pendingUsers.length
        }
      });
    } catch (error) {
      logger.error('Error in getPendingApprovals', error);
      next(error);
    }
  }

  /**
   * GET /approvals/organizations — paginated, filterable.
   *
   * A TPO is pinned to companies whatever `type` they send; an admin may ask
   * for any type. The registering staff are included so the reviewer can see
   * WHO is asking, not just the name of the organization.
   */
  async listOrganizations(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const { status = 'pending', type, search } = req.query;
      const { page, limit, offset } = pageParams(req.query);

      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Unknown status' });
      }
      if (type && !ORG_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Unknown organization type' });
      }

      const where = { approvalStatus: status };
      if (!isAdmin) where.type = 'company';
      else if (type) where.type = type;
      if (search) {
        const term = `%${String(search).trim()}%`;
        where[Op.or] = [
          { name: { [Op.iLike]: term } },
          { domain: { [Op.iLike]: term } },
          { contactEmail: { [Op.iLike]: term } }
        ];
      }

      const { count, rows } = await Organization.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'users',
            // Staff only — a university's student list is not the reviewer's
            // business here and could be thousands of rows.
            where: {
              role: { [Op.in]: ['tpo', 'recruiter', 'principal', 'teacher', 'school_admin', 'career_counselor'] }
            },
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'approvalStatus', 'createdAt'],
            required: false
          },
          { model: User, as: 'approver', attributes: ['id', 'firstName', 'lastName'], required: false }
        ],
        order: [[status === 'pending' ? 'createdAt' : 'approvedAt', status === 'pending' ? 'ASC' : 'DESC']],
        limit,
        offset,
        distinct: true
      });

      res.json({
        message: 'Organizations retrieved successfully',
        organizations: rows,
        pagination: pagination(page, limit, count)
      });
    } catch (error) {
      logger.error('Error in listOrganizations', error);
      next(error);
    }
  }

  /**
   * GET /approvals/users — paginated, filterable account queue.
   *
   * TPO: recruiters only. Admin: any non-admin role, plus `status=stuck` — the
   * accounts the old approval path left approved-but-inactive, which re-approve
   * cleanly through `decideUser`.
   */
  async listUsers(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      const { status = 'pending', role, search } = req.query;
      const { page, limit, offset } = pageParams(req.query);

      if (!LIST_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Unknown status' });
      }
      if (role && !USER_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Unknown role' });
      }

      const where = { ...userStatusWhere(status) };
      if (!isAdmin) where.role = 'recruiter';
      else where.role = role || { [Op.ne]: 'admin' };
      if (search) {
        const term = `%${String(search).trim()}%`;
        where[Op.or] = [
          { firstName: { [Op.iLike]: term } },
          { lastName: { [Op.iLike]: term } },
          { email: { [Op.iLike]: term } }
        ];
      }

      const { count, rows } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['passwordHash'] },
        include: [
          {
            model: Organization,
            as: 'organization',
            attributes: ['id', 'name', 'type', 'logoUrl', 'approvalStatus']
          },
          {
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['position', 'department', 'experience'],
            required: false
          }
        ],
        order: [['createdAt', status === 'pending' ? 'ASC' : 'DESC']],
        limit,
        offset,
        distinct: true
      });

      res.json({
        message: 'Accounts retrieved successfully',
        users: rows,
        pagination: pagination(page, limit, count)
      });
    } catch (error) {
      logger.error('Error in listUsers', error);
      next(error);
    }
  }

  // Approve/reject organization
  async approveOrganization(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors);

    const transaction = await sequelize.transaction();
    try {
      const { organizationId } = req.params;
      const { action, notes } = req.body; // action: 'approve' or 'reject'
      const { id: approverId } = req.user;

      const organization = await Organization.findByPk(organizationId, { transaction });
      if (!organization) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      if (!canDecideOrganization(req.user, organization)) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Placement officers can approve companies only. Institutions are approved by an administrator.'
        });
      }

      if (organization.approvalStatus !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Invalid Status',
          message: 'Organization is not pending approval'
        });
      }

      const approved = action === 'approve';
      await organization.update(
        {
          approvalStatus: approved ? 'approved' : 'rejected',
          // An admin approving an institution is the verification step; there
          // is no separate one for it to wait on.
          ...(approved && req.user.role === 'admin' ? { isVerified: true } : {}),
          approvedBy: approverId,
          approvedAt: new Date(),
          approvalNotes: notes || null
        },
        { transaction }
      );

      const usersChanged = await cascadeOrganizationDecision({
        User,
        organization,
        action,
        approverId,
        notes: notes || null,
        transaction
      });

      await transaction.commit();

      audit(req, `organization_${PAST_TENSE[action]}`, 'organization', organization.id, {
        name: organization.name,
        type: organization.type,
        notes: notes || null,
        staffAccounts: usersChanged
      });

      res.json({
        message: `Organization ${PAST_TENSE[action]} successfully`,
        organization: {
          id: organization.id,
          name: organization.name,
          type: organization.type,
          approvalStatus: organization.approvalStatus,
          approvedAt: organization.approvedAt
        },
        usersUpdated: usersChanged
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      logger.error('Error in approveOrganization', error);
      next(error);
    }
  }

  /**
   * Approve/reject one account.
   *
   * Accepts a pending account, and also an approved account that cannot sign
   * in (`isActive: false`) — re-approving is how an admin repairs the rows the
   * old static-update path produced. Instance `update` with `isActive` written
   * explicitly, so it is right whether or not the model hook runs.
   *
   * `onlyRole` is set by the legacy `/recruiters/:id` route.
   */
  async decideUser(req, res, next, onlyRole = null) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const { userId } = req.params;
      const { action, notes } = req.body;

      const user = await User.findByPk(userId, {
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'type', 'approvalStatus'] }]
      });
      if (!user) {
        return res.status(404).json({ error: 'User Not Found', message: 'User not found' });
      }
      if (onlyRole && user.role !== onlyRole) {
        return res.status(400).json({ error: 'Invalid User Role', message: `User is not a ${onlyRole}` });
      }
      if (!canDecideUser(req.user, user)) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: req.user.role === 'tpo'
            ? 'Placement officers can approve recruiters only.'
            : 'You cannot change this account\'s approval.'
        });
      }

      const repairable = user.approvalStatus === 'approved' && !user.isActive && action === 'approve';
      if (user.approvalStatus !== 'pending' && !repairable) {
        return res.status(400).json({ error: 'Invalid Status', message: 'User is not pending approval' });
      }

      // Approving a TPO into an institution nobody has approved yet would give
      // them a live account over an unvetted tenant. Approve the institution
      // first; that cascades to its waiting staff anyway.
      if (
        action === 'approve' &&
        user.organization &&
        user.organization.approvalStatus !== 'approved' &&
        STAFF_ROLES_BY_ORG_TYPE[user.organization.type]?.includes(user.role)
      ) {
        return res.status(409).json({
          error: 'Organization Not Approved',
          message: `${user.organization.name} is ${user.organization.approvalStatus}. Approve the organization first — its waiting staff are approved with it.`
        });
      }

      const approved = action === 'approve';
      await user.update({
        approvalStatus: approved ? 'approved' : 'rejected',
        isActive: approved,
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNotes: notes || null
      });

      audit(req, `${user.role === 'recruiter' ? 'recruiter' : 'user'}_${PAST_TENSE[action]}`, 'user', user.id, {
        role: user.role,
        email: user.email,
        organization: user.organization?.name || null,
        notes: notes || null,
        repaired: repairable || undefined
      });

      res.json({
        message: `${user.role === 'recruiter' ? 'Recruiter' : 'Account'} ${PAST_TENSE[action]} successfully`,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          organization: user.organization?.name,
          approvalStatus: user.approvalStatus,
          isActive: user.isActive,
          approvedAt: user.approvedAt
        }
      });
    } catch (error) {
      logger.error('Error in decideUser', error);
      next(error);
    }
  }

  // Approve/reject individual recruiter (legacy route)
  async approveRecruiter(req, res, next) {
    return module.exports.decideUser(req, res, next, 'recruiter');
  }

  async approveUser(req, res, next) {
    return module.exports.decideUser(req, res, next, null);
  }

  // Bulk approve/reject organizations
  async bulkApproveOrganizations(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors);

    const { organizationIds, action, notes } = req.body;
    const ids = [...new Set(organizationIds.map((id) => parseInt(id, 10)))];

    const transaction = await sequelize.transaction();
    try {
      const organizations = await Organization.findAll({
        where: { id: { [Op.in]: ids }, approvalStatus: 'pending' },
        transaction
      });

      // Refuse the whole batch rather than silently skipping: a TPO sending a
      // university id here is not a UI mistake.
      const forbidden = organizations.filter((org) => !canDecideOrganization(req.user, org));
      if (forbidden.length > 0) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Access Forbidden',
          message: `You cannot decide on: ${forbidden.map((o) => o.name).join(', ')}. Placement officers can approve companies only.`
        });
      }

      const approved = action === 'approve';
      let usersUpdated = 0;
      for (const organization of organizations) {
        // eslint-disable-next-line no-await-in-loop
        await organization.update(
          {
            approvalStatus: approved ? 'approved' : 'rejected',
            ...(approved && req.user.role === 'admin' ? { isVerified: true } : {}),
            approvedBy: req.user.id,
            approvedAt: new Date(),
            approvalNotes: notes || null
          },
          { transaction }
        );
        // eslint-disable-next-line no-await-in-loop
        usersUpdated += await cascadeOrganizationDecision({
          User,
          organization,
          action,
          approverId: req.user.id,
          notes: notes || null,
          transaction
        });
      }

      await transaction.commit();

      organizations.forEach((organization) =>
        audit(req, `organization_${PAST_TENSE[action]}`, 'organization', organization.id, {
          name: organization.name,
          type: organization.type,
          notes: notes || null,
          bulk: true
        })
      );

      res.json({
        message: `${organizations.length} organizations ${PAST_TENSE[action]} successfully`,
        updatedCount: organizations.length,
        skipped: ids.length - organizations.length,
        usersUpdated
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      logger.error('Error in bulkApproveOrganizations', error);
      next(error);
    }
  }

  /**
   * Counts for the queue's headline tiles, scoped like the lists: a TPO's
   * numbers are companies and recruiters, an admin's are everything.
   */
  async getApprovalStats(req, res, next) {
    try {
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && !req.user.organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      const orgScope = isAdmin ? {} : { type: 'company' };
      const userScope = isAdmin ? { role: { [Op.ne]: 'admin' } } : { role: 'recruiter' };

      const [orgStats, userStats, stuckUsers, pendingJobs, recentApprovals] = await Promise.all([
        Organization.findAll({
          where: { ...orgScope, approvalStatus: { [Op.ne]: null } },
          attributes: ['approvalStatus', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['approvalStatus'],
          raw: true
        }),
        User.findAll({
          where: { ...userScope, approvalStatus: { [Op.ne]: null } },
          attributes: ['approvalStatus', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['approvalStatus'],
          raw: true
        }),
        User.count({ where: { ...userScope, approvalStatus: 'approved', isActive: false } }),
        Job.count({ where: { status: 'pending_review' } }),
        Organization.findAll({
          where: { ...orgScope, approvalStatus: { [Op.in]: ['approved', 'rejected'] } },
          attributes: ['id', 'name', 'type', 'approvalStatus', 'approvedAt'],
          include: [{ model: User, as: 'approver', attributes: ['firstName', 'lastName'] }],
          order: [['approvedAt', 'DESC NULLS LAST']],
          limit: 10
        })
      ]);

      res.json({
        message: 'Approval statistics retrieved successfully',
        stats: {
          organizations: orgStats,
          // `recruiters` kept as the key existing callers read; for an admin it
          // covers every non-admin role.
          recruiters: userStats,
          users: userStats,
          stuckUsers,
          pendingJobs,
          recentApprovals
        }
      });
    } catch (error) {
      logger.error('Error in getApprovalStats', error);
      next(error);
    }
  }
}

module.exports = new ApprovalController();
