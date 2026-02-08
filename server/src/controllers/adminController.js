// server/src/controllers/adminController.js
const { User, Organization, StudentProfile, RecruiterProfile, RecruiterAllowedOrganization, AuditLog } = require('../models');
const authService = require('../services/authService');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

class AdminController {
  // Create a new user
  async createUser(req, res, next) {
    try {
      const { email, password, role, organizationId, ...userData } = req.body;

      // Validate required fields
      if (!email || !password || !role) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Email, password, and role are required'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          error: 'User Already Exists',
          message: 'A user with this email already exists'
        });
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

        // Enforce role-organization rules
        // Students: university, college, or school. TPOs: university or college.
        if (role === 'student' && !['university', 'college', 'school'].includes(organization.type)) {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'Students can only belong to university, college, or school organizations'
          });
        }
        if (role === 'tpo' && organization.type !== 'university' && organization.type !== 'college') {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'TPOs can only belong to university or college organizations'
          });
        }

        if (role === 'recruiter' && organization.type !== 'company') {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'Recruiters can only belong to company organizations'
          });
        }
        
        // School roles must belong to school organizations
        if ((role === 'principal' || role === 'teacher' || role === 'school_admin' || role === 'career_counselor') && organization.type !== 'school') {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'School roles can only belong to school organizations'
          });
        }
      } else if (role !== 'admin') {
        return res.status(400).json({
          error: 'Organization Required',
          message: 'Organization is required for this role'
        });
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
      next(error);
    }
  }

  // Update user
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { password, organizationId, ...updateData } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      // Prevent admin from deleting themselves
      if (id == req.user.id && updateData.isActive === false) {
        return res.status(400).json({
          error: 'Invalid Operation',
          message: 'You cannot deactivate yourself'
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

          // Enforce role-organization rules
          if ((user.role === 'student' || user.role === 'tpo') && organization.type !== 'university' && organization.type !== 'college') {
            return res.status(400).json({
              error: 'Invalid Organization Type',
              message: 'Students and TPOs can only belong to university or college organizations'
            });
          }

          if (user.role === 'recruiter' && organization.type !== 'company') {
            return res.status(400).json({
              error: 'Invalid Organization Type',
              message: 'Recruiters can only belong to company organizations'
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

      await user.update(updateData);

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
          message: 'You cannot delete yourself'
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
   * Import students from Excel file (Admin only).
   * Expects multipart/form-data: file (xlsx/xls), organizationId.
   * Sheet: first row = headers. Required: email. Optional: first name, last name, phone, student id, course, branch, year of study, graduation year, gender, cgpa, percentage, date of birth.
   */
  async importStudentsFromExcel(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Please upload an Excel file (.xlsx or .xls)'
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

      const defaultPassword = process.env.BULK_IMPORT_DEFAULT_PASSWORD || 'Student@123';
      const passwordHash = await authService.hashPassword(defaultPassword);

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const headerMap = (rawKey) => {
        const k = String(rawKey).trim().toLowerCase().replace(/\s+/g, '_');
        const map = {
          email: 'email',
          first_name: 'firstName',
          firstname: 'firstName',
          last_name: 'lastName',
          lastname: 'lastName',
          phone: 'phone',
          student_id: 'studentId',
          studentid: 'studentId',
          course: 'course',
          branch: 'branch',
          year: 'yearOfStudy',
          year_of_study: 'yearOfStudy',
          yearofstudy: 'yearOfStudy',
          graduation_year: 'graduationYear',
          graduationyear: 'graduationYear',
          gender: 'gender',
          cgpa: 'cgpa',
          percentage: 'percentage',
          date_of_birth: 'dateOfBirth',
          dob: 'dateOfBirth',
          dateofbirth: 'dateOfBirth'
        };
        return map[k] || null;
      };

      const created = [];
      const skipped = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const rowNum = i + 2; // 1-based + header
        const get = (key) => {
          const k = Object.keys(raw).find(kk => headerMap(kk) === key);
          return k != null ? (raw[k] != null ? String(raw[k]).trim() : '') : '';
        };

        const email = (get('email') || '').toLowerCase();
        if (!email) {
          errors.push({ row: rowNum, message: 'Missing email' });
          continue;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ row: rowNum, email, message: 'Invalid email format' });
          continue;
        }

        const existingUser = await User.findOne({ where: { email: { [Op.iLike]: email } } });
        if (existingUser) {
          skipped.push({ row: rowNum, email, reason: 'Email already exists' });
          continue;
        }

        const firstName = get('firstName') || get('lastName') || 'Student';
        const lastName = get('lastName') || get('firstName') || 'User';
        const phone = get('phone') || null;
        const studentId = get('studentId') || null;
        const course = get('course') || null;
        const branch = get('branch') || null;
        const yearOfStudyRaw = get('yearOfStudy') ? parseInt(get('yearOfStudy'), 10) : null;
        let graduationYear = get('graduationYear') ? parseInt(get('graduationYear'), 10) : null;
        let yearOfStudy = null;
        if (yearOfStudyRaw != null && !Number.isNaN(yearOfStudyRaw)) {
          if (yearOfStudyRaw >= 1 && yearOfStudyRaw <= 6) {
            yearOfStudy = yearOfStudyRaw;
          } else if (yearOfStudyRaw >= 1900 && yearOfStudyRaw <= 2100) {
            graduationYear = graduationYear || yearOfStudyRaw;
          }
        }
        const genderRaw = (get('gender') || '').toLowerCase();
        const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : null;
        const cgpaVal = get('cgpa');
        const cgpa = cgpaVal !== '' && !Number.isNaN(Number(cgpaVal)) ? parseFloat(cgpaVal) : null;
        const pctVal = get('percentage');
        const percentage = pctVal !== '' && !Number.isNaN(Number(pctVal)) ? parseFloat(pctVal) : null;
        const dateOfBirth = get('dateOfBirth') || null;

        try {
          const user = await User.create({
            email,
            passwordHash,
            role: 'student',
            organizationId,
            firstName,
            lastName,
            phone: phone || null,
            approvalStatus: 'approved',
            isActive: true,
            isVerified: true,
            approvedBy: req.user.id,
            approvedAt: new Date()
          });

          await StudentProfile.create({
            userId: user.id,
            studentId,
            course,
            branch,
            yearOfStudy,
            graduationYear,
            gender,
            cgpa,
            percentage,
            dateOfBirth
          });

          created.push({ row: rowNum, email, name: `${firstName} ${lastName}` });
        } catch (err) {
          errors.push({ row: rowNum, email, message: err.message || 'Failed to create user' });
        }
      }

      res.json({
        message: 'Import completed',
        summary: {
          total: rows.length,
          created: created.length,
          skipped: skipped.length,
          errors: errors.length
        },
        created,
        skipped,
        errors
      });
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
      const { email, password, organizationId, ...userData } = req.body;

      if (!email || !password || !organizationId) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Email, password, and organizationId are required'
        });
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

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          error: 'User Already Exists',
          message: 'A user with this email already exists'
        });
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
      next(error);
    }
  }

  // Update TPO
  async updateTPO(req, res, next) {
    try {
      const { id } = req.params;
      const { password, organizationId, ...updateData } = req.body;

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

      // Check if TPO's university has students
      if (tpo.organizationId) {
        const studentCount = await User.count({
          where: {
            role: 'student',
            organizationId: tpo.organizationId
          }
        });

        if (studentCount > 0 && hardDelete !== 'true') {
          return res.status(400).json({
            error: 'Cannot Delete TPO',
            message: `This TPO's university has ${studentCount} student(s). Please reassign students or use hard delete.`
          });
        }
      }

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
        where: { id: recruiterUserId, role: 'recruiter' },
        include: [{ model: RecruiterProfile, as: 'recruiterProfile' }]
      });
      if (!user || !user.recruiterProfile) {
        return res.status(404).json({
          error: 'Recruiter Not Found',
          message: 'Recruiter or recruiter profile not found'
        });
      }
      const profile = user.recruiterProfile;
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
        where: { id: recruiterUserId, role: 'recruiter' },
        include: [{ model: RecruiterProfile, as: 'recruiterProfile' }]
      });
      if (!user || !user.recruiterProfile) {
        return res.status(404).json({
          error: 'Recruiter Not Found',
          message: 'Recruiter or recruiter profile not found'
        });
      }
      const profile = user.recruiterProfile;
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

