// server/src/controllers/auditController.js
//
// The audit trail existed as a table and was written to from several places,
// but nothing ever read it back — so approvals, posting decisions, bulk status
// changes and recruiter access to student records were all recorded and then
// invisible.
//
// Two views, because there are two very different questions:
//
//   * staff: "what has been done on this institution, and by whom"
//   * a student: "who has looked at my record"
//
// The second is the one no competitor in this market ships, and it is what
// makes the recruiter scoping already built into this codebase visible to the
// person it protects.

const { AuditLog, User, Organization } = require('../models');
const { Op } = require('sequelize');

// Actions worth showing a human, mapped to plain descriptions. Anything not
// listed is still returned — the table is the record, not this list — but these
// are the ones with a sentence written for them.
const ACTION_LABELS = {
  recruiter_candidate_access: 'Viewed student profiles',
  recruiter_student_list_access: 'Searched student records',
  job_posting_approved: 'Approved a job posting',
  job_posting_rejected: 'Sent a job posting back',
  application_bulk_status_by_identifier: 'Bulk-updated application statuses',
  organization_approved: 'Approved a company',
  organization_rejected: 'Rejected a company',
  recruiter_approved: 'Approved a recruiter',
  recruiter_rejected: 'Rejected a recruiter'
};

const describe = (action) =>
  ACTION_LABELS[action] || String(action).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const shape = (row) => ({
  id: row.id,
  action: row.action,
  description: describe(row.action),
  entityType: row.entityType,
  entityId: row.entityId,
  at: row.createdAt,
  by: row.user
    ? {
        id: row.user.id,
        name: [row.user.firstName, row.user.lastName].filter(Boolean).join(' '),
        email: row.user.email,
        role: row.user.role,
        organization: row.user.organization?.name || null
      }
    : null
});

class AuditController {
  /**
   * The staff activity feed.
   *
   * An admin sees the whole platform. A TPO sees their own staff's actions plus
   * every disclosure of one of their students to an outside recruiter — see the
   * comment on that branch for why the second half matters.
   */
  async getAuditLog(req, res, next) {
    try {
      const { page = 1, limit = 25, action, userId } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
      const offset = (parseInt(page, 10) - 1) * limitNum;

      const where = {};
      if (action) where.action = action;
      if (userId) where.userId = parseInt(userId, 10);

      const actor = {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
      };

      if (req.user.role === 'admin') {
        const { count, rows } = await AuditLog.findAndCountAll({
          where,
          // Not required, so platform-level entries with no actor still appear.
          include: [{ ...actor, required: false }],
          order: [['createdAt', 'DESC']],
          limit: limitNum,
          offset,
          distinct: true
        });

        return res.json({
          message: 'Audit log retrieved successfully',
          entries: rows.map(shape),
          pagination: {
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(count / limitNum),
            totalItems: count,
            itemsPerPage: limitNum
          }
        });
      }

      // A TPO's trail is two things joined, and the second matters more:
      //
      //   * what their own staff did, and
      //   * every time an outside recruiter was shown one of their students.
      //
      // Filtering purely on the actor's organisation gives only the first and
      // hides exactly the access the placement cell is accountable for — a
      // TechCorp recruiter viewing Tech University students is not a TechCorp
      // matter. The second set is matched on the disclosed student ids in
      // JavaScript rather than SQL for the same reason as `getMyDataAccess`:
      // `new_values` is `json`, and containment is a `jsonb` operator.
      if (!req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Your account is not attached to an institution'
        });
      }

      const ownStudents = await User.findAll({
        where: { organizationId: req.user.organizationId, role: 'student' },
        attributes: ['id']
      });
      const studentIds = new Set(ownStudents.map((u) => u.id));

      const [ownStaffEntries, accessEntries] = await Promise.all([
        AuditLog.findAll({
          where,
          include: [
            { ...actor, required: true, where: { organizationId: req.user.organizationId } }
          ],
          order: [['createdAt', 'DESC']],
          limit: 500
        }),
        AuditLog.findAll({
          where: {
            ...where,
            action: { [Op.in]: ['recruiter_candidate_access', 'recruiter_student_list_access'] }
          },
          include: [{ ...actor, required: false }],
          order: [['createdAt', 'DESC']],
          limit: 500
        })
      ]);

      const seen = new Set(ownStaffEntries.map((e) => e.id));
      const merged = [...ownStaffEntries];
      for (const entry of accessEntries) {
        if (seen.has(entry.id)) continue;
        const disclosed = entry.newValues?.studentIds;
        if (Array.isArray(disclosed) && disclosed.some((id) => studentIds.has(id))) {
          merged.push(entry);
        }
      }
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const paged = merged.slice(offset, offset + limitNum);
      res.json({
        message: 'Audit log retrieved successfully',
        entries: paged.map(shape),
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(merged.length / limitNum),
          totalItems: merged.length,
          itemsPerPage: limitNum
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * "Who has looked at my record?"
   *
   * Recruiter access is logged with the ids of the students actually disclosed,
   * so this reads those entries back and keeps the ones naming the caller.
   *
   * The filtering happens in JavaScript rather than in the query on purpose:
   * `audit_logs.new_values` is a `json` column, and Postgres implements the
   * containment operator only for `jsonb`, so there is no index-backed way to
   * ask "rows whose studentIds array contains me" without a migration. The read
   * is bounded to access-type actions and a recent window, which keeps it small;
   * if the table grows past that, the column wants converting to `jsonb` rather
   * than this loop growing.
   */
  async getMyDataAccess(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
      const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

      const rows = await AuditLog.findAll({
        where: {
          action: { [Op.in]: ['recruiter_candidate_access', 'recruiter_student_list_access'] },
          createdAt: { [Op.gte]: since }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'role'],
            include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 2000
      });

      const mine = rows
        .filter((row) => {
          const ids = row.newValues?.studentIds;
          return Array.isArray(ids) && ids.includes(req.user.id);
        })
        .slice(0, limitNum)
        .map((row) => ({
          id: row.id,
          at: row.createdAt,
          // Deliberately the company, not the individual recruiter: the student
          // is owed a truthful record of which organisations saw them, and
          // naming a specific employee invites retaliation in both directions.
          organization: row.user?.organization?.name || 'A recruiter',
          description: 'Your profile appeared in a recruiter candidate search'
        }));

      res.json({
        message: 'Data access history retrieved successfully',
        entries: mine,
        windowDays: 180
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();
