// server/src/controllers/adminController.js
const { User, Organization, StudentProfile, RecruiterProfile, RecruiterAllowedOrganization, AuditLog } = require('../models');
const authService = require('../services/authService');
const { Op } = require('sequelize');

const ROLES = ['student', 'recruiter', 'tpo', 'admin', 'principal', 'teacher', 'school_admin', 'career_counselor'];

// Which kind of organization each role can belong to. One table instead of
// the four slightly different copies that lived in create/update, the update
// copy of which rejected every school student and never looked at school
// staff at all, so an edit could turn a teacher into a recruiter at a school.
const ORG_TYPES_FOR_ROLE = {
  student: ['university', 'college', 'school'],
  tpo: ['university', 'college'],
  recruiter: ['company'],
  principal: ['school'],
  teacher: ['school'],
  school_admin: ['school'],
  career_counselor: ['school']
};
const ORG_TYPE_WORDS = {
  student: 'a university, college or school',
  tpo: 'a university or college',
  recruiter: 'a company',
  principal: 'a school',
  teacher: 'a school',
  school_admin: 'a school',
  career_counselor: 'a school'
};

/** Emails are compared and stored trimmed and lower-case. */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/** The house 400 shape: a readable message plus per-field details. */
const invalid = (res, field, message, error = 'Validation Error') =>
  res.status(400).json({ error, message, details: [{ field, message }] });

/** Returns a sentence when `organization` cannot hold `role`, else null. */
const roleOrgProblem = (role, organization) => {
  if (role === 'admin') return null;
  if (!organization) return `Choose the organization this ${role.replace(/_/g, ' ')} belongs to`;
  if (!ORG_TYPES_FOR_ROLE[role]?.includes(organization.type)) {
    return `${organization.name} is a ${organization.type}; this role must belong to ${ORG_TYPE_WORDS[role]}`;
  }
  return null;
};

/** True when someone other than `exceptUserId` can still administer the platform. */
const anotherActiveAdminExists = async (exceptUserId) =>
  (await User.count({
    where: { role: 'admin', isActive: true, id: { [Op.ne]: exceptUserId } }
  })) > 0;

/**
 * Fire-and-forget audit row for an admin change to an account. Role changes
 * and deactivations decide who can see student data, and none of them were
 * recorded.
 */
const auditAccountChange = (req, action, user, newValues) =>
  AuditLog.create({
    userId: req.user.id,
    action,
    entityType: 'user',
    entityId: user.id,
    newValues: { email: user.email, ...newValues },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  }).catch(() => {});

const sequelizeValidation = (res, error) => {
  const details = (error.errors || []).map((e) => ({ field: e.path, message: e.message }));
  return res.status(400).json({
    error: 'Validation Error',
    message: details.map((d) => d.message).join('. ') || 'Some details need fixing.',
    details
  });
};

class AdminController {
  // Create a new user
  async createUser(req, res, next) {
    try {
      const { password, role, organizationId, firstName, lastName, phone } = req.body;
      // Only the fields this form owns. Spreading the body let a caller set
      // anything on the row (approval, verification, timestamps).
      const userData = { firstName, lastName, phone };
      const email = normalizeEmail(req.body.email);

      const missing = [
        !String(firstName || '').trim() && { field: 'firstName', message: 'First name is required' },
        !String(lastName || '').trim() && { field: 'lastName', message: 'Last name is required' },
        !email && { field: 'email', message: 'Email is required' },
        !password && { field: 'password', message: 'Password is required' },
        !role && { field: 'role', message: 'Choose a role' }
      ].filter(Boolean);
      if (missing.length) {
        return res.status(400).json({ error: 'Validation Error', message: missing[0].message, details: missing });
      }
      if (!ROLES.includes(role)) return invalid(res, 'role', 'Choose one of the listed roles');
      if (String(password).length < 8) {
        return invalid(res, 'password', 'Password must be at least 8 characters');
      }

      // Case-insensitive: " R.K.Sharma@Gmail.com" and "r.k.sharma@gmail.com"
      // are one inbox, and the exact-match lookup let both be created.
      const existingUser = await User.findOne({ where: { email: { [Op.iLike]: email } } });
      if (existingUser) {
        return invalid(res, 'email', `An account with ${email} already exists`, 'User Already Exists');
      }

      // Validate organization if provided
      if (organizationId) {
        const organization = await Organization.findByPk(organizationId);
        if (!organization) {
          return res.status(400).json({
            error: 'Invalid Organization',
            message: 'Organization not found'
          });
        }

        const problem = roleOrgProblem(role, organization);
        if (problem) return invalid(res, 'organizationId', problem, 'Invalid Organization Type');
      } else if (role !== 'admin') {
        return invalid(res, 'organizationId', roleOrgProblem(role, null), 'Organization Required');
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Determine approval status based on role
      let approvalStatus = 'approved';
      let isActive = true;

      if (role === 'admin') {
        // Admins are always approved
        approvalStatus = 'approved';
        isActive = true;
      } else if (role === 'recruiter') {
        // Recruiters require TPO approval (unless admin explicitly approves)
        // For now, admin-created recruiters are auto-approved
        // Change to 'pending' if you want TPO approval required
        approvalStatus = 'approved';
        isActive = true;
      } else if (role === 'student' || role === 'tpo') {
        // Students and TPOs are auto-approved
        approvalStatus = 'approved';
        isActive = true;
      }

      // Clean phone number
      if (userData.phone === '') {
        userData.phone = null;
      }

      // Create user
      const user = await User.create({
        email,
        passwordHash,
        role,
        organizationId: role === 'admin' ? null : organizationId,
        approvalStatus,
        isActive,
        isVerified: true, // Admin-created users are verified
        approvedBy: req.user.id,
        approvedAt: new Date(),
        ...userData
      });

      // Return user without password
      const userResponse = await User.findByPk(user.id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: RecruiterProfile, as: 'recruiterProfile' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse
      });
    } catch (error) {
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      next(error);
    }
  }

  // Update user
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { password, organizationId } = req.body;
      // Whitelist: the rest of the body used to go straight into update().
      const updateData = Object.fromEntries(
        ['firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'approvalStatus']
          .filter((k) => req.body[k] !== undefined)
          .map((k) => [k, req.body[k]])
      );

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      const isSelf = Number(id) === Number(req.user.id);
      const nextRole = updateData.role ?? user.role;
      if (updateData.role !== undefined && !ROLES.includes(nextRole)) {
        return invalid(res, 'role', 'Choose one of the listed roles');
      }

      // Guard rails on admin accounts. An admin could demote or deactivate
      // themselves from the edit form (only `isActive` was checked), and
      // nothing stopped the last administrator being removed, which leaves
      // nobody able to approve institutions.
      if (isSelf && nextRole !== 'admin') {
        return invalid(res, 'role', 'You cannot change your own role. Ask another admin to do it.', 'Invalid Operation');
      }
      if (isSelf && (updateData.isActive === false || (updateData.approvalStatus && updateData.approvalStatus !== 'approved'))) {
        return invalid(res, 'isActive', 'You cannot deactivate your own account', 'Invalid Operation');
      }
      const losesAdmin =
        user.role === 'admin' &&
        (nextRole !== 'admin' || updateData.isActive === false || ['pending', 'rejected'].includes(updateData.approvalStatus));
      if (losesAdmin && !(await anotherActiveAdminExists(user.id))) {
        return invalid(res, 'role', 'This is the only active admin. Make someone else an admin first.', 'Invalid Operation');
      }

      if (updateData.email !== undefined) {
        updateData.email = normalizeEmail(updateData.email);
        if (!updateData.email) return invalid(res, 'email', 'Email is required');
        if (updateData.email !== String(user.email).toLowerCase()) {
          const taken = await User.findOne({
            where: { email: { [Op.iLike]: updateData.email }, id: { [Op.ne]: user.id } }
          });
          if (taken) return invalid(res, 'email', `Another account already uses ${updateData.email}`);
        }
      }
      ['firstName', 'lastName'].forEach((k) => {
        if (updateData[k] !== undefined) updateData[k] = String(updateData[k]).trim();
      });
      if (updateData.firstName === '' || updateData.lastName === '') {
        return invalid(res, updateData.firstName === '' ? 'firstName' : 'lastName', 'Name cannot be empty');
      }

      // Re-check the role/organization pair whenever either side changes, so
      // an edit cannot leave (say) a recruiter attached to a school.
      if (updateData.role !== undefined || organizationId !== undefined) {
        const nextOrgId =
          nextRole === 'admin' ? null : organizationId !== undefined ? organizationId || null : user.organizationId;
        const organization = nextOrgId ? await Organization.findByPk(nextOrgId) : null;
        if (nextOrgId && !organization) {
          return invalid(res, 'organizationId', 'That organization no longer exists', 'Invalid Organization');
        }
        const problem = roleOrgProblem(nextRole, organization);
        if (problem) return invalid(res, 'organizationId', problem, 'Invalid Organization Type');
        updateData.organizationId = nextOrgId;
      }

      // Update password if provided
      if (password) {
        updateData.passwordHash = await authService.hashPassword(password);
      }

      // Clean phone number
      if (updateData.phone === '') {
        updateData.phone = null;
      }

      const before = { role: user.role, organizationId: user.organizationId, isActive: user.isActive, approvalStatus: user.approvalStatus };
      await user.update(updateData);
      const changed = Object.fromEntries(
        Object.keys(before).filter((k) => before[k] !== user[k]).map((k) => [k, { from: before[k], to: user[k] }])
      );
      if (Object.keys(changed).length || password) {
        auditAccountChange(req, 'admin_user_updated', user, { ...changed, ...(password ? { passwordReset: true } : {}) });
      }

      // Return updated user
      const updatedUser = await User.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: RecruiterProfile, as: 'recruiterProfile' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      next(error);
    }
  }

  // Delete user (soft delete by default)
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const { hardDelete } = req.query;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      // Prevent admin from deleting themselves
      if (id == req.user.id) {
        return res.status(400).json({
          error: 'Invalid Operation',
          message: 'You cannot deactivate your own account'
        });
      }
      if (user.role === 'admin' && !(await anotherActiveAdminExists(user.id))) {
        return res.status(400).json({
          error: 'Invalid Operation',
          message: 'This is the only active admin. Make someone else an admin first.'
        });
      }

      if (hardDelete === 'true') {
        // Hard delete - remove from database
        await user.destroy();
        return res.json({
          message: 'User deleted permanently'
        });
      } else {
        // Soft delete - deactivate
        await user.update({ isActive: false });
        auditAccountChange(req, 'admin_user_deactivated', user, { role: user.role });
        return res.json({
          message: 'User deactivated successfully'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Get user by ID
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: RecruiterProfile, as: 'recruiterProfile' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      res.json({
        message: 'User retrieved successfully',
        user
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update users
  async bulkUpdateUsers(req, res, next) {
    try {
      const { userIds, updates } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'User IDs array is required'
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Updates object is required'
        });
      }

      // Prevent admin from bulk updating themselves
      if (userIds.includes(req.user.id.toString()) && updates.isActive === false) {
        return res.status(400).json({
          error: 'Invalid Operation',
          message: 'You cannot deactivate yourself'
        });
      }

      // Update users
      const [affectedRows] = await User.update(updates, {
        where: {
          id: {
            [Op.in]: userIds.map(id => parseInt(id))
          }
        }
      });

      res.json({
        message: `${affectedRows} user(s) updated successfully`,
        affectedRows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import students from a spreadsheet (admin, and via /users/import the
   * institution's own staff). Expects multipart/form-data: file (xlsx/xls/csv), organizationId.
   * Sheet: first row = headers. Required: email. Optional: first name, last name, phone, student id, course, branch, year of study, graduation year, gender, cgpa, percentage, date of birth.
   */
  async importStudentsFromExcel(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Choose a spreadsheet to upload (.xlsx, .xls or .csv)'
        });
      }

      const organizationId = req.body.organizationId ? parseInt(req.body.organizationId, 10) : null;
      if (!organizationId) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Organization is required. Select a university, college, or school.'
        });
      }

      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        return res.status(400).json({
          error: 'Invalid Organization',
          message: 'Organization not found'
        });
      }
      if (!['university', 'college', 'school'].includes(organization.type)) {
        return res.status(400).json({
          error: 'Invalid Organization Type',
          message: 'Students can only be imported into university, college, or school organizations'
        });
      }

      // Parsing, validation and the per-student transaction live in the
      // shared importer (also used by the TPO/school import). The copy that
      // was here failed CSV dates ("2004-05-12" became a serial number),
      // only knew the template's exact headers, and left an account without
      // a profile behind whenever the profile insert failed.
      //
      // Each student gets their own random temporary password, returned once
      // in `created` for the importer to hand out (the client offers a CSV).
      const { status, body } = await require('../utils/studentImport').importStudents(
        require('../models'),
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          organizationId,
          actorId: req.user.id
        }
      );
      if (status !== 200) return res.status(status).json(body);
      const { created = [], skipped = [], errors = [], summary = {} } = body;

      // Who loaded which students into which institution. Bulk import creates
      // accounts with access to the platform in one request, and nothing
      // recorded it. Emails only — never the temporary passwords.
      await AuditLog.create({
        userId: req.user.id,
        action: 'students_bulk_imported',
        entityType: 'organization',
        entityId: organizationId,
        newValues: {
          total: summary.total,
          created: created.map((c) => c.email),
          skipped: skipped.length,
          errors: errors.length
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch(() => {});

      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json(body);
    } catch (error) {
      next(error);
    }
  }

  // Get all TPOs
  async getAllTPOs(req, res, next) {
    try {
      const { page = 1, limit = 20, organizationId, search } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = { role: 'tpo' };

      if (organizationId) {
        whereClause.organizationId = organizationId;
      }

      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: tpos } = await User.findAndCountAll({
        where: whereClause,
        include: [
          { model: Organization, as: 'organization' }
        ],
        attributes: { exclude: ['passwordHash'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'TPOs retrieved successfully',
        tpos,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          hasMore: offset + tpos.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create TPO
  async createTPO(req, res, next) {
    try {
      const { password, organizationId, firstName, lastName, phone } = req.body;
      const userData = { firstName, lastName, phone };
      const email = normalizeEmail(req.body.email);

      const missing = [
        !String(firstName || '').trim() && { field: 'firstName', message: 'First name is required' },
        !String(lastName || '').trim() && { field: 'lastName', message: 'Last name is required' },
        !email && { field: 'email', message: 'Email is required' },
        !password && { field: 'password', message: 'Password is required' },
        !organizationId && { field: 'organizationId', message: 'Choose the college or university' }
      ].filter(Boolean);
      if (missing.length) {
        return res.status(400).json({ error: 'Validation Error', message: missing[0].message, details: missing });
      }
      if (String(password).length < 8) {
        return invalid(res, 'password', 'Password must be at least 8 characters');
      }

      // Validate organization is a university
      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        return res.status(400).json({
          error: 'Invalid Organization',
          message: 'Organization not found'
        });
      }

      if (organization.type !== 'university' && organization.type !== 'college') {
        return res.status(400).json({
          error: 'Invalid Organization Type',
          message: 'TPOs can only belong to university or college organizations'
        });
      }

      const existingUser = await User.findOne({ where: { email: { [Op.iLike]: email } } });
      if (existingUser) {
        return invalid(res, 'email', `An account with ${email} already exists`, 'User Already Exists');
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Clean phone number
      if (userData.phone === '') {
        userData.phone = null;
      }

      // Create TPO user
      const tpo = await User.create({
        email,
        passwordHash,
        role: 'tpo',
        organizationId,
        approvalStatus: 'approved',
        isActive: true,
        isVerified: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
        ...userData
      });

      const tpoResponse = await User.findByPk(tpo.id, {
        include: [
          { model: Organization, as: 'organization' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      res.status(201).json({
        message: 'TPO created successfully',
        tpo: tpoResponse
      });
    } catch (error) {
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      next(error);
    }
  }

  // Update TPO
  async updateTPO(req, res, next) {
    try {
      const { id } = req.params;
      const { password, organizationId } = req.body;
      const updateData = Object.fromEntries(
        ['firstName', 'lastName', 'email', 'phone']
          .filter((k) => req.body[k] !== undefined)
          .map((k) => [k, req.body[k]])
      );
      if (updateData.email !== undefined) {
        updateData.email = normalizeEmail(updateData.email);
        const taken = await User.findOne({
          where: { email: { [Op.iLike]: updateData.email }, id: { [Op.ne]: Number(req.params.id) } }
        });
        if (taken) return invalid(res, 'email', `Another account already uses ${updateData.email}`);
      }

      const tpo = await User.findOne({
        where: { id, role: 'tpo' }
      });

      if (!tpo) {
        return res.status(404).json({
          error: 'TPO Not Found',
          message: 'TPO not found'
        });
      }

      // Validate organization if provided
      if (organizationId !== undefined) {
        if (organizationId) {
          const organization = await Organization.findByPk(organizationId);
          if (!organization) {
            return res.status(400).json({
              error: 'Invalid Organization',
              message: 'Organization not found'
            });
          }

          if (organization.type !== 'university' && organization.type !== 'college') {
            return res.status(400).json({
              error: 'Invalid Organization Type',
              message: 'TPOs can only belong to university or college organizations'
            });
          }
        }
        updateData.organizationId = organizationId;
      }

      // Update password if provided
      if (password) {
        updateData.passwordHash = await authService.hashPassword(password);
      }

      // Clean phone number
      if (updateData.phone === '') {
        updateData.phone = null;
      }

      await tpo.update(updateData);

      const updatedTPO = await User.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      res.json({
        message: 'TPO updated successfully',
        tpo: updatedTPO
      });
    } catch (error) {
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      next(error);
    }
  }

  // Delete TPO
  async deleteTPO(req, res, next) {
    try {
      const { id } = req.params;
      const { hardDelete } = req.query;

      const tpo = await User.findOne({
        where: { id, role: 'tpo' }
      });

      if (!tpo) {
        return res.status(404).json({
          error: 'TPO Not Found',
          message: 'TPO not found'
        });
      }

      // There used to be a check here refusing to deactivate any TPO whose
      // college had students, pointing at a "hard delete" no screen offers.
      // Deactivating a TPO does not touch the students (they belong to the
      // organization, not the officer), and replacing an officer who has
      // left is exactly the case where there are students — so the TPO
      // could never be removed at all.

      if (hardDelete === 'true') {
        await tpo.destroy();
        return res.json({
          message: 'TPO deleted permanently'
        });
      } else {
        await tpo.update({ isActive: false });
        return res.json({
          message: 'TPO deactivated successfully'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  async getRecruiterPermissions(req, res, next) {
    try {
      const recruiterUserId = parseInt(req.params.id, 10);
      if (!Number.isInteger(recruiterUserId) || recruiterUserId < 1) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Recruiter ID must be a positive integer'
        });
      }
      const user = await User.findOne({
        where: { id: recruiterUserId, role: 'recruiter' }
      });
      if (!user) {
        return res.status(404).json({
          error: 'Recruiter Not Found',
          message: 'Recruiter not found'
        });
      }
      // A recruiter who never saved their own profile had no row, and this
      // answered 404 — so an admin could not grant access to a recruiter until
      // the recruiter happened to edit their profile. An empty profile is the
      // correct starting point (no allowed institutions = no access).
      const [profile] = await RecruiterProfile.findOrCreate({
        where: { userId: user.id },
        defaults: { userId: user.id }
      });
      const allowedOrgs = await RecruiterAllowedOrganization.findAll({
        where: { recruiterProfileId: profile.id },
        attributes: ['organizationId']
      });
      res.json({
        allowedOrganizationIds: allowedOrgs.map((r) => r.organizationId),
        allowedYears: profile.allowedYears || [],
        allowedStreams: profile.allowedStreams || [],
        allowedRegions: profile.allowedRegions || [],
        allowedStates: profile.allowedStates || [],
        allowedCities: profile.allowedCities || []
      });
    } catch (error) {
      next(error);
    }
  }

  async setRecruiterAllowedOrganizations(req, res, next) {
    try {
      const recruiterUserId = parseInt(req.params.id, 10);
      if (!Number.isInteger(recruiterUserId) || recruiterUserId < 1) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Recruiter ID must be a positive integer'
        });
      }
      const {
        organizationIds,
        allowedYears,
        allowedStreams,
        allowedRegions,
        allowedStates,
        allowedCities
      } = req.body;
      if (!Array.isArray(organizationIds)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'organizationIds must be an array of organization IDs'
        });
      }
      const user = await User.findOne({
        where: { id: recruiterUserId, role: 'recruiter' }
      });
      if (!user) {
        return res.status(404).json({
          error: 'Recruiter Not Found',
          message: 'Recruiter not found'
        });
      }
      // A recruiter who never saved their own profile had no row, and this
      // answered 404 — so an admin could not grant access to a recruiter until
      // the recruiter happened to edit their profile. An empty profile is the
      // correct starting point (no allowed institutions = no access).
      const [profile] = await RecruiterProfile.findOrCreate({
        where: { userId: user.id },
        defaults: { userId: user.id }
      });
      const validIds = organizationIds.filter((n) => Number.isInteger(Number(n)) && Number(n) > 0);
      const orgs = await Organization.findAll({
        where: { id: { [Op.in]: validIds } },
        attributes: ['id', 'type']
      });
      const institutionTypes = ['school', 'college', 'university'];
      const allowedIds = orgs
        .filter((o) => institutionTypes.includes(o.type))
        .map((o) => o.id);
      await RecruiterAllowedOrganization.destroy({
        where: { recruiterProfileId: profile.id }
      });
      if (allowedIds.length) {
        await RecruiterAllowedOrganization.bulkCreate(
          allowedIds.map((organizationId) => ({
            recruiterProfileId: profile.id,
            organizationId
          }))
        );
      }
      const profileUpdates = {};
      if (Array.isArray(allowedYears)) {
        profileUpdates.allowedYears = allowedYears.filter((n) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 6);
      }
      if (Array.isArray(allowedStreams)) {
        profileUpdates.allowedStreams = allowedStreams.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
      }
      if (Array.isArray(allowedRegions)) {
        profileUpdates.allowedRegions = allowedRegions.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
      }
      if (Array.isArray(allowedStates)) {
        profileUpdates.allowedStates = allowedStates.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
      }
      if (Array.isArray(allowedCities)) {
        profileUpdates.allowedCities = allowedCities.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
      }
      if (Object.keys(profileUpdates).length) {
        await profile.update(profileUpdates);
      }
      await AuditLog.create({
        userId: req.user.id,
        action: 'recruiter_allowed_organizations_updated',
        entityType: 'recruiter_profile',
        entityId: profile.id,
        newValues: {
          recruiterUserId,
          organizationIds: allowedIds,
          ...(Object.keys(profileUpdates).length ? profileUpdates : {})
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      });
      const updated = await RecruiterAllowedOrganization.findAll({
        where: { recruiterProfileId: profile.id },
        attributes: ['organizationId']
      });
      res.json({
        message: 'Recruiter allowed organizations updated',
        allowedOrganizationIds: updated.map((r) => r.organizationId)
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();

