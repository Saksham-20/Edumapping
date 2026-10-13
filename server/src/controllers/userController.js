// server/src/controllers/userController.js
const { User, StudentProfile, RecruiterProfile, Organization, Achievement, Application, Job, File, AuditLog } = require('../models');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');
const { Op } = require('sequelize');
const recruiterAccessService = require('../services/recruiterAccessService');
const accessService = require('../services/accessService');
const path = require('path');

// Helper functions outside the class
const sanitizeNumericField = (value) => {
  if (value === '' || value === null || value === undefined || value === 'null') {
    return null;
  }
  // Convert to number and validate
  const numValue = parseFloat(value);
  return isNaN(numValue) ? null : numValue;
};

// Optional text-ish columns whose validators or types reject an empty string.
// The profile form sends every input, blank ones as '', so a brand-new
// student's first save failed on isUrl (the URL fields), on the DATEONLY
// column ('Invalid date') and on the gender ENUM. Blank means "not set".
const BLANK_IS_NULL_FIELDS = ['linkedinUrl', 'githubUrl', 'portfolioUrl', 'dateOfBirth', 'gender', 'studentId', 'course', 'branch'];

const sanitizeProfileData = (profileData) => {
  const sanitized = { ...profileData };
  for (const field of BLANK_IS_NULL_FIELDS) {
    if (field in sanitized && (sanitized[field] === '' || sanitized[field] === 'Invalid date')) {
      sanitized[field] = null;
    }
  }
  
  // Sanitize numeric fields
  if ('cgpa' in sanitized) {
    sanitized.cgpa = sanitizeNumericField(sanitized.cgpa);
  }
  if ('percentage' in sanitized) {
    sanitized.percentage = sanitizeNumericField(sanitized.percentage);
  }
  if ('yearOfStudy' in sanitized) {
    sanitized.yearOfStudy = sanitizeNumericField(sanitized.yearOfStudy);
  }
  if ('graduationYear' in sanitized) {
    sanitized.graduationYear = sanitizeNumericField(sanitized.graduationYear);
  }
  // The academic eligibility fields. A blank input arrives as '' and would be
  // handed straight to an INTEGER or DECIMAL column; every numeric field on
  // this profile has to pass through here for that reason.
  for (const field of [
    'activeBacklogs',
    'totalBacklogs',
    'class10Percentage',
    'class12Percentage',
    'diplomaPercentage',
    'educationGapYears'
  ]) {
    if (field in sanitized) {
      sanitized[field] = sanitizeNumericField(sanitized[field]);
    }
  }

  return sanitized;
};

/**
 * What each role may write through PUT /users/profile.
 *
 * The handler used to pass the whole body to StudentProfile.update /
 * RecruiterProfile.update, so a student could set their own placementStatus,
 * lift their own placement sanction, mark themselves verified or eligible, or
 * point resumeUrl at someone else's file; and a recruiter could widen their
 * own allowedYears/Streams/Regions… limits, the scoping that decides which
 * students they may see. Each list is what the person legitimately owns.
 */
const USER_EDITABLE_FIELDS = ['firstName', 'lastName', 'phone', 'profilePicture'];
const STUDENT_EDITABLE_FIELDS = [
  'studentId', 'dateOfBirth', 'gender', 'course', 'branch', 'yearOfStudy', 'graduationYear',
  'cgpa', 'percentage', 'activeBacklogs', 'totalBacklogs', 'class10Percentage', 'class12Percentage',
  'diplomaPercentage', 'educationGapYears', 'address', 'skills', 'bio',
  'linkedinUrl', 'githubUrl', 'portfolioUrl'
];
const RECRUITER_EDITABLE_FIELDS = [
  'department', 'position', 'bio', 'experience', 'linkedinUrl', 'workMode', 'locations', 'hiringRegions'
];

// Academic facts a placement cell has signed off on. Once the profile is
// verified, eligibility checks rely on these, so the student cannot change
// them without the cell unlocking the profile first.
const LOCKED_WHEN_VERIFIED = [
  'course', 'branch', 'graduationYear', 'yearOfStudy', 'cgpa', 'activeBacklogs', 'totalBacklogs',
  'class10Percentage', 'class12Percentage', 'diplomaPercentage', 'educationGapYears', 'studentId', 'percentage'
];
const NUMERIC_LOCKED = new Set([
  'graduationYear', 'yearOfStudy', 'cgpa', 'activeBacklogs', 'totalBacklogs',
  'class10Percentage', 'class12Percentage', 'diplomaPercentage', 'educationGapYears', 'percentage'
]);

const pick = (source, fields) => {
  const out = {};
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
};

/**
 * Whether a submitted value differs from the stored one. The form posts every
 * field on every save, so an unchanged value must compare equal even though
 * DECIMAL columns come back as strings ("8.50" vs 8.5) and blanks as null.
 */
const valueChanged = (field, stored, submitted) => {
  const blank = (v) => v === null || v === undefined || v === '';
  if (blank(stored) && blank(submitted)) return false;
  if (blank(stored) !== blank(submitted)) return true;
  if (NUMERIC_LOCKED.has(field)) return Number(stored) !== Number(submitted);
  return String(stored).trim() !== String(submitted).trim();
};

// School roles whose listing is pinned to their own institution. Teachers are
// included: a teacher needs the roster of the school they teach at, and the
// scoping below means including them widens nothing beyond that school.
const SCHOOL_SCOPED_ROLES = ['principal', 'school_admin', 'career_counselor', 'teacher'];
// Everyone whose listings are pinned to their own institution. The TPO was
// missing: `?organizationId=5` let a college's placement officer list a
// school's pupils.
const INSTITUTION_SCOPED_ROLES = ['tpo', ...SCHOOL_SCOPED_ROLES];

const NOT_FOUND = { error: 'User Not Found', message: 'User profile not found' };

class UserController {

  async getProfile(req, res, next) {
    try {
      const userId = req.params.id ? parseInt(req.params.id, 10) : req.user.id;

      // GET /users/:id answered for any id to anyone signed in — every
      // student could read every other student's phone, marks and documents,
      // school pupils included. Out-of-scope is 404, not 403, so the endpoint
      // does not confirm which ids exist.
      if (userId !== req.user.id) {
        const target = await User.findByPk(userId, { attributes: ['id', 'role', 'organizationId'] });
        if (!target || !(await accessService.canViewUser(req.user, target))) {
          return res.status(404).json(NOT_FOUND);
        }
        if (req.user.role === 'recruiter') {
          AuditLog.create({
            userId: req.user.id,
            action: 'recruiter_profile_access',
            entityType: 'user',
            entityId: target.id,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent')
          }).catch(() => {});
        }
      }

      const user = await User.findByPk(userId, {
        include: [
          {
            model: Organization,
            as: 'organization'
          },
          {
            model: StudentProfile,
            as: 'studentProfile'
          },
          {
            model: RecruiterProfile,
            as: 'recruiterProfile'
          },
          {
            model: Achievement,
            as: 'achievements',
            order: [['issueDate', 'DESC']]
          }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User profile not found'
        });
      }

      // Serialise first, then annotate. Assigning a plain object back onto the
      // Sequelize instance's association was dropped when the instance was
      // serialised, so resumeFileId never reached the client.
      const body = user.toJSON();
      if (body.studentProfile && body.studentProfile.resumeUrl) {
        const resumeFile = await File.findOne({
          where: {
            userId: user.id,
            fileType: 'resume'
          },
          order: [['createdAt', 'DESC']]
        });

        if (resumeFile) {
          body.studentProfile.resumeFileId = resumeFile.id;
          body.studentProfile.resumeDownloadUrl = `/api/files/${resumeFile.id}/download`;
        }
      }

      res.json({
        message: 'Profile retrieved successfully',
        user: body
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      // Always the caller's own profile; the route has no :id.
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      const userFields = pick(req.body, USER_EDITABLE_FIELDS);
      if (userFields.phone === '') userFields.phone = null;
      // A profile picture is either cleared or one this user uploaded through
      // POST /users/profile/picture. Anything else (another user's file, an
      // external tracking URL, a javascript: URL) is ignored.
      if ('profilePicture' in userFields) {
        const pic = userFields.profilePicture;
        const ownUpload = typeof pic === 'string' &&
          new RegExp(`^/uploads/\\d+-(?:[0-9a-f]{16}-)?profile_${userId}_[\\w.-]+$`).test(pic);
        if (!(pic === null || pic === '' || pic === user.profilePicture || ownUpload)) {
          delete userFields.profilePicture;
        } else if (pic === '') {
          userFields.profilePicture = null;
        }
      }

      if (user.role === 'student') {
        const sanitizedProfileData = sanitizeProfileData(pick(req.body, STUDENT_EDITABLE_FIELDS));
        let studentProfile = await StudentProfile.findOne({ where: { userId } });

        if (studentProfile && studentProfile.verificationStatus === 'verified') {
          const lockedFields = LOCKED_WHEN_VERIFIED.filter(
            (field) => field in sanitizedProfileData &&
              valueChanged(field, studentProfile[field], sanitizedProfileData[field])
          );
          if (lockedFields.length) {
            return res.status(423).json({
              error: 'Profile Locked',
              message: 'Your academic details were verified by your placement cell and are locked. Ask your placement cell to unlock them.',
              lockedFields
            });
          }
        }

        if (Object.keys(userFields).length) await user.update(userFields);
        if (studentProfile) {
          await studentProfile.update(sanitizedProfileData);
        } else if (Object.keys(sanitizedProfileData).length) {
          studentProfile = await StudentProfile.create({
            ...sanitizedProfileData,
            userId
          });
        }
      } else if (user.role === 'recruiter') {
        if (Object.keys(userFields).length) await user.update(userFields);
        const recruiterData = pick(req.body, RECRUITER_EDITABLE_FIELDS);
        const [recruiterProfile] = await RecruiterProfile.findOrCreate({
          where: { userId },
          defaults: { userId }
        });
        if (Object.keys(recruiterData).length) await recruiterProfile.update(recruiterData);
      } else if (Object.keys(userFields).length) {
        await user.update(userFields);
      }

      // Return updated user
      const updatedUser = await User.findByPk(userId, {
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: RecruiterProfile, as: 'recruiterProfile' }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        organizationId,
        organizationType,
        institutionType,
        isActive,
        approvalStatus,
        search,
        year,
        stream,
        region,
        state,
        city,
        zone
      } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const limitNum = Math.min(parseInt(limit, 10) || 10, 100);

      const whereClause = {};
      if (role) whereClause.role = role;
      if (organizationId) whereClause.organizationId = organizationId;
      if (isActive !== undefined) whereClause.isActive = isActive === 'true';
      // The admin's pending-users queue filters on this; it was ignored, so the
      // queue showed everybody.
      if (['pending', 'approved', 'rejected'].includes(approvalStatus)) {
        whereClause.approvalStatus = approvalStatus;
      }

      // Institution staff (TPO and school leadership) may list people, but only
      // their own institution's. Forced here rather than trusted from the query
      // string, so passing another organizationId cannot widen the result set.
      if (INSTITUTION_SCOPED_ROLES.includes(req.user.role)) {
        if (!req.user.organizationId) {
          return res.status(403).json({
            error: 'Access Forbidden',
            message: 'Your account is not attached to an institution'
          });
        }
        whereClause.organizationId = req.user.organizationId;
      }

      if (req.user.role === 'recruiter') {
        const allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(req.user.id);
        recruiterAccessService.applyRecruiterOrgScope(whereClause, allowedOrgIds);
        AuditLog.create({
          userId: req.user.id,
          action: 'recruiter_student_list_access',
          entityType: 'user_list',
          entityId: null,
          newValues: { endpoint: 'getAllUsers', filters: { role, page, limit }, allowedOrgCount: allowedOrgIds.length },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent')
        }).catch(() => {});
      }

      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const orgWhere = {};
      const instType = institutionType || organizationType;
      if (instType) orgWhere.type = instType;
      if (region) orgWhere.region = { [Op.iLike]: `%${region}%` };
      if (state) orgWhere.state = { [Op.iLike]: `%${state}%` };
      if (city) orgWhere.city = { [Op.iLike]: `%${city}%` };
      if (zone) orgWhere.zone = { [Op.iLike]: `%${zone}%` };

      const studentProfileWhere = {};
      if (year) studentProfileWhere.yearOfStudy = parseInt(year, 10);
      if (stream) studentProfileWhere.branch = { [Op.iLike]: `%${stream}%` };

      if (req.user.role === 'recruiter') {
        const limits = await recruiterAccessService.getRecruiterFilterLimits(req.user.id);
        if (limits.orgWhere && Object.keys(limits.orgWhere).length) {
          Object.assign(orgWhere, limits.orgWhere);
        }
        if (limits.studentProfileWhere && Object.keys(limits.studentProfileWhere).length) {
          Object.assign(studentProfileWhere, limits.studentProfileWhere);
        }
      }

      const requireOrg = Object.keys(orgWhere).length > 0;
      const requireStudentProfile = Object.keys(studentProfileWhere).length > 0;
      const includeClause = [
        {
          model: Organization,
          as: 'organization',
          required: requireOrg,
          where: requireOrg ? orgWhere : undefined,
          attributes: ['id', 'name', 'type', 'region', 'state', 'city', 'zone']
        },
        {
          model: StudentProfile,
          as: 'studentProfile',
          required: requireStudentProfile,
          where: requireStudentProfile ? studentProfileWhere : undefined
        },
        { model: RecruiterProfile, as: 'recruiterProfile', required: false }
      ];

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        include: includeClause,
        attributes: { exclude: ['passwordHash'] },
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true
      });

      res.json({
        message: 'Users retrieved successfully',
        users,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(count / limitNum),
          totalUsers: count,
          hasMore: offset + users.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsersByRole(req, res, next) {
    try {
      const { role } = req.params;
      const {
        organizationId,
        institutionType,
        year,
        stream,
        region,
        state,
        city,
        zone,
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = { role, isActive: true };
      if (organizationId) whereClause.organizationId = organizationId;

      // Same pinning as getAllUsers: a TPO lists their own institution only.
      if (INSTITUTION_SCOPED_ROLES.includes(req.user.role)) {
        if (!req.user.organizationId) {
          return res.status(403).json({
            error: 'Access Forbidden',
            message: 'Your account is not attached to an institution'
          });
        }
        whereClause.organizationId = req.user.organizationId;
      }
      // A recruiter browses students and nobody else. Other roles' rosters
      // (TPOs, school staff, other companies' recruiters) are not theirs.
      if (req.user.role === 'recruiter' && role !== 'student') {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Recruiters can only browse students'
        });
      }

      if (req.user.role === 'recruiter') {
        const allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(req.user.id);
        recruiterAccessService.applyRecruiterOrgScope(whereClause, allowedOrgIds);
        AuditLog.create({
          userId: req.user.id,
          action: 'recruiter_student_list_access',
          entityType: 'user_list',
          entityId: null,
          newValues: { endpoint: 'getUsersByRole', role, filters: { page, limit }, allowedOrgCount: allowedOrgIds.length },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent')
        }).catch(() => {});
      }

      const orgWhere = {};
      if (institutionType) orgWhere.type = institutionType;
      if (region) orgWhere.region = { [Op.iLike]: `%${region}%` };
      if (state) orgWhere.state = { [Op.iLike]: `%${state}%` };
      if (city) orgWhere.city = { [Op.iLike]: `%${city}%` };
      if (zone) orgWhere.zone = { [Op.iLike]: `%${zone}%` };

      const studentProfileWhere = {};
      if (year) studentProfileWhere.yearOfStudy = parseInt(year, 10);
      if (stream) studentProfileWhere.branch = { [Op.iLike]: `%${stream}%` };

      if (req.user.role === 'recruiter') {
        const limits = await recruiterAccessService.getRecruiterFilterLimits(req.user.id);
        if (limits.orgWhere && Object.keys(limits.orgWhere).length) {
          Object.assign(orgWhere, limits.orgWhere);
        }
        if (limits.studentProfileWhere && Object.keys(limits.studentProfileWhere).length) {
          Object.assign(studentProfileWhere, limits.studentProfileWhere);
        }
      }

      const requireOrg = Object.keys(orgWhere).length > 0;
      const requireStudentProfile = Object.keys(studentProfileWhere).length > 0;
      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
      const offset = (parseInt(page, 10) - 1) * limitNum;

      const includeClause = [
        {
          model: Organization,
          as: 'organization',
          required: requireOrg,
          where: requireOrg ? orgWhere : undefined,
          attributes: ['id', 'name', 'type', 'region', 'state', 'city', 'zone']
        },
        {
          model: StudentProfile,
          as: 'studentProfile',
          required: requireStudentProfile,
          where: requireStudentProfile ? studentProfileWhere : undefined
        },
        { model: RecruiterProfile, as: 'recruiterProfile', required: false }
      ];

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        include: includeClause,
        attributes: { exclude: ['passwordHash'] },
        limit: limitNum,
        offset,
        order: [['firstName', 'ASC']],
        distinct: true
      });

      res.json({
        message: `${role}s retrieved successfully`,
        users,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(count / limitNum),
          totalUsers: count,
          hasMore: offset + users.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      await user.update({ isActive });

      res.json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      // Soft delete by deactivating
      await user.update({ isActive: false });

      res.json({
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadProfilePicture(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No File',
          message: 'Please select an image file to upload'
        });
      }

      const userId = req.user.id;
      const fileService = require('../services/fileService');
      
      // `profile_<id>_` is what lets the public /uploads mount serve it (see
      // services/fileAccessService). The extension comes from the checked MIME
      // type, not from the browser's file name.
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype] || 'jpg';
      const fileName = `profile_${userId}_${Date.now()}.${ext}`;
      const filePath = await fileService.saveFile(req.file.buffer, fileName, req.file.mimetype);
      // Stored as the public URL path. It used to store the absolute path on
      // the server's disk, which no browser could load and which disclosed the
      // host's directory layout to anyone who could see the profile.
      const profilePicture = process.env.STORAGE_TYPE === 'minio'
        ? await fileService.getDownloadUrl(filePath)
        : `/uploads/${path.basename(filePath)}`;

      // Update user profile picture
      await User.update(
        { profilePicture },
        { where: { id: userId } }
      );

      res.json({
        message: 'Profile picture uploaded successfully',
        profilePicture
      });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const { q, role, organizationId } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          error: 'Invalid Query',
          message: 'Search query must be at least 2 characters long'
        });
      }

      const whereClause = {
        isActive: true,
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${q}%` } },
          { lastName: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ]
      };

      if (role) whereClause.role = role;
      if (organizationId) whereClause.organizationId = organizationId;

      // Search was reachable by anyone (and in fact unreachable, shadowed by
      // GET /:id). Now: admins search everyone, institution staff their own
      // institution, recruiters the students in their scope.
      const include = [
        { model: Organization, as: 'organization' },
        { model: StudentProfile, as: 'studentProfile' },
        { model: RecruiterProfile, as: 'recruiterProfile' }
      ];
      if (INSTITUTION_SCOPED_ROLES.includes(req.user.role)) {
        whereClause.organizationId = req.user.organizationId || -1;
      } else if (req.user.role === 'recruiter') {
        whereClause.role = 'student';
        const allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(req.user.id);
        recruiterAccessService.applyRecruiterOrgScope(whereClause, allowedOrgIds);
        const limits = await recruiterAccessService.getRecruiterFilterLimits(req.user.id);
        if (limits.orgWhere && Object.keys(limits.orgWhere).length) {
          include[0] = { ...include[0], where: limits.orgWhere, required: true };
        }
        if (limits.studentProfileWhere && Object.keys(limits.studentProfileWhere).length) {
          include[1] = { ...include[1], where: limits.studentProfileWhere, required: true };
        }
      } else if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access Forbidden', message: 'You cannot search users' });
      }

      const users = await User.findAll({
        where: whereClause,
        include,
        attributes: { exclude: ['passwordHash'] },
        limit: 20,
        order: [['firstName', 'ASC']]
      });

      res.json({
        message: 'Search results retrieved successfully',
        users,
        query: q
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Block, remove or reinstate a student's placement participation.
   *
   * A reason is required in every direction, lifting included: "why was this
   * student let back in" is a question a placement cell gets asked, and an
   * unexplained reversal is as unhelpful as an unexplained sanction.
   */
  async setPlacementSanction(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }

      const { id } = req.params;
      const { sanction, reason, until } = req.body;

      const student = await User.findByPk(id, {
        include: [{ model: StudentProfile, as: 'studentProfile' }]
      });
      if (!student || student.role !== 'student') {
        return res.status(404).json({ error: 'Student Not Found', message: 'Student not found' });
      }
      // A TPO acts only for their own institution.
      if (req.user.role !== 'admin' && student.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only sanction students at your own institution'
        });
      }
      if (!student.studentProfile) {
        return res.status(409).json({
          error: 'No Student Profile',
          message: 'This student has no profile to sanction'
        });
      }

      const previous = student.studentProfile.placementSanction;
      await student.studentProfile.update({
        placementSanction: sanction,
        sanctionReason: reason,
        // Only a temporary bar carries an expiry; lifting clears it.
        sanctionUntil: sanction === 'none' ? null : until || null,
        sanctionedBy: req.user.id,
        sanctionedAt: new Date()
      });

      res.json({
        message:
          sanction === 'none'
            ? 'Placement participation restored'
            : `Student ${sanction === 'removed' ? 'removed from' : 'blocked from applying in'} placements`,
        studentProfile: student.studentProfile
      });

      notificationService
        .createNotification(
          student.id,
          sanction === 'none' ? 'Placement participation restored' : 'Placement participation suspended',
          sanction === 'none'
            ? `You can apply for roles again. ${reason}`
            : `${sanction === 'removed' ? 'You have been removed from placements.' : 'You cannot apply to new roles for now.'} ${reason}`,
          'system_alert',
          { sanction },
          'urgent'
        )
        .catch(() => {});

      AuditLog.create({
        userId: req.user.id,
        action: 'placement_sanction_changed',
        entityType: 'student_profile',
        entityId: student.studentProfile.id,
        oldValues: { placementSanction: previous },
        newValues: { placementSanction: sanction, reason, until: until || null },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch(() => {});
    } catch (error) {
      next(error);
    }
  }

  async getTopCandidates(req, res, next) {
    try {
      const { limit = 10, organizationId } = req.query;

      // Two different organizations are involved here and the original code
      // conflated them into one `targetOrgId`, which broke the endpoint for
      // the role it exists to serve:
      //
      //   * whose jobs the candidates applied to — the hiring company;
      //   * which institution the candidates come from — the allow-list.
      //
      // For a recruiter it defaulted to their own company and then tested that
      // against the allow-list, which holds universities and so never contains
      // their own company: every default call returned 403. Passing an allowed
      // university instead made it look for students who had applied to that
      // *university's* postings rather than to the recruiter's own, so it
      // returned an empty list. The endpoint could not succeed either way.
      //
      // A recruiter's candidates are now the students who applied to their own
      // organization's jobs, restricted to the institutions they are allowed to
      // see. `organizationId` narrows within that allow-list rather than
      // choosing whose jobs to read.
      let jobOrgId = null;
      let studentOrgIds = null;

      if (req.user.role === 'recruiter') {
        const allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(req.user.id);
        if (allowedOrgIds.length === 0) {
          return res.json({
            message: 'Top candidates retrieved successfully',
            candidates: []
          });
        }
        if (organizationId && !allowedOrgIds.includes(parseInt(organizationId, 10))) {
          return res.status(403).json({
            error: 'Access Forbidden',
            message: 'You do not have access to this organization'
          });
        }
        jobOrgId = req.user.organizationId;
        studentOrgIds = organizationId ? [parseInt(organizationId, 10)] : allowedOrgIds;
      } else {
        // Admin. `organizationId` selects the hiring organization; a platform
        // admin belongs to none, so absent it they see candidates everywhere.
        jobOrgId = organizationId || req.user.organizationId || null;
      }

      const jobs = await Job.findAll({
        where: jobOrgId ? { organizationId: jobOrgId } : {},
        attributes: ['id']
      });
      const jobIds = jobs.map(job => job.id);

      if (jobIds.length === 0) {
        return res.json({
          message: 'Top candidates retrieved successfully',
          candidates: []
        });
      }

      const candidateWhere = {
        role: 'student',
        isActive: true
      };
      if (studentOrgIds) {
        candidateWhere.organizationId = { [Op.in]: studentOrgIds };
      }

      const candidates = await User.findAll({
        where: candidateWhere,
        include: [
          {
            model: StudentProfile,
            as: 'studentProfile',
            required: false
          },
          {
            model: Organization,
            as: 'organization'
          },
          {
            model: Application,
            as: 'applications',
            where: {
              jobId: { [Op.in]: jobIds }
            },
            required: true, // Only students who have applied
            attributes: ['id', 'status', 'createdAt']
          }
        ],
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        limit: parseInt(limit),
        order: [
          ['studentProfile', 'cgpa', 'DESC NULLS LAST'],
          ['firstName', 'ASC']
        ],
        distinct: true
      });

      // Record which students were actually disclosed, not just that a search
      // happened. Without the ids there is no way to answer "who looked at my
      // record", which is the question a student actually has — and the one
      // piece of the recruiter-scoping story that was missing.
      if (req.user.role === 'recruiter') {
        AuditLog.create({
          userId: req.user.id,
          action: 'recruiter_candidate_access',
          entityType: 'user_list',
          entityId: null,
          newValues: {
            endpoint: 'getTopCandidates',
            studentIds: candidates.map((c) => c.id),
            organizationId: organizationId ? parseInt(organizationId, 10) : null
          },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent')
        }).catch(() => {});
      }

      res.json({
        message: 'Top candidates retrieved successfully',
        candidates
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();