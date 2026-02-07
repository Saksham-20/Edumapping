// server/src/controllers/userController.js
const { User, StudentProfile, RecruiterProfile, Organization, Achievement, Application, Job, File, AuditLog } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const recruiterAccessService = require('../services/recruiterAccessService');

// Helper functions outside the class
const sanitizeNumericField = (value) => {
  if (value === '' || value === null || value === undefined || value === 'null') {
    return null;
  }
  // Convert to number and validate
  const numValue = parseFloat(value);
  return isNaN(numValue) ? null : numValue;
};

const sanitizeProfileData = (profileData) => {
  const sanitized = { ...profileData };
  
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
  
  return sanitized;
};

class UserController {

  async getProfile(req, res, next) {
    try {
      const userId = req.params.id || req.user.id;
      
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

      // If user has a student profile with resume, find the resume file
      if (user.studentProfile && user.studentProfile.resumeUrl) {
        const resumeFile = await File.findOne({
          where: {
            userId: user.id,
            fileType: 'resume'
          },
          order: [['createdAt', 'DESC']]
        });

        if (resumeFile) {
          // Add file ID and download URL to student profile
          const profileData = user.studentProfile.toJSON();
          profileData.resumeFileId = resumeFile.id;
          profileData.resumeDownloadUrl = `/api/files/${resumeFile.id}/download`;
          user.studentProfile = profileData;
        }
      }

      res.json({
        message: 'Profile retrieved successfully',
        user
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

      const userId = req.params.id || req.user.id;
      const { firstName, lastName, phone, profilePicture, ...profileData } = req.body;

      // Update user basic info
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      await user.update({
        firstName,
        lastName,
        phone,
        profilePicture
      });

      // Update role-specific profile
      if (user.role === 'student' && profileData) {
        // SANITIZE PROFILE DATA HERE - This is the key fix!
        const sanitizedProfileData = sanitizeProfileData(profileData);
        
        let studentProfile = await StudentProfile.findOne({ where: { userId } });
        
        if (studentProfile) {
          await studentProfile.update(sanitizedProfileData);
        } else {
          await StudentProfile.create({
            userId,
            ...sanitizedProfileData
          });
        }
      } else if (user.role === 'recruiter' && profileData) {
        let recruiterProfile = await RecruiterProfile.findOne({ where: { userId } });
        
        if (recruiterProfile) {
          await recruiterProfile.update(profileData);
        } else {
          await RecruiterProfile.create({
            userId,
            ...profileData
          });
        }
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
      
      const fileName = `profile_${userId}_${Date.now()}.${req.file.originalname.split('.').pop()}`;
      const filePath = await fileService.saveFile(req.file.buffer, fileName, req.file.mimetype);

      // Update user profile picture
      await User.update(
        { profilePicture: filePath },
        { where: { id: userId } }
      );

      res.json({
        message: 'Profile picture uploaded successfully',
        profilePicture: filePath
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

      const users = await User.findAll({
        where: whereClause,
        include: [
          { model: Organization, as: 'organization' },
          { model: StudentProfile, as: 'studentProfile' },
          { model: RecruiterProfile, as: 'recruiterProfile' }
        ],
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

  async getTopCandidates(req, res, next) {
    try {
      const { limit = 10, organizationId } = req.query;
      const targetOrgId = organizationId || req.user.organizationId;
      let allowedOrgIds = [];
      if (req.user.role === 'recruiter') {
        allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(req.user.id);
        if (allowedOrgIds.length === 0) {
          return res.json({
            message: 'Top candidates retrieved successfully',
            candidates: []
          });
        }
        if (targetOrgId && !allowedOrgIds.includes(parseInt(targetOrgId, 10))) {
          return res.status(403).json({
            error: 'Access Forbidden',
            message: 'You do not have access to this organization'
          });
        }
      }

      if (!targetOrgId) {
        return res.status(400).json({
          error: 'Organization Required',
          message: 'Organization ID is required'
        });
      }

      const jobs = await Job.findAll({
        where: { organizationId: targetOrgId },
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
      if (req.user.role === 'recruiter') {
        candidateWhere.organizationId = { [Op.in]: allowedOrgIds };
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