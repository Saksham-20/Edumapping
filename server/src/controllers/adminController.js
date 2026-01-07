// server/src/controllers/adminController.js
const { User, Organization, StudentProfile, RecruiterProfile } = require('../models');
const authService = require('../services/authService');
const { Op } = require('sequelize');

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
        // Students can belong to universities (colleges) or schools
        // TPOs can only belong to universities (colleges)
        // School roles (principal, teacher, school_admin, career_counselor) can only belong to schools
        if (role === 'student' && organization.type !== 'university' && organization.type !== 'school') {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'Students can only belong to university or school organizations'
          });
        }
        if (role === 'tpo' && organization.type !== 'university') {
          return res.status(400).json({
            error: 'Invalid Organization Type',
            message: 'TPOs can only belong to university organizations'
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
          if ((user.role === 'student' || user.role === 'tpo') && organization.type !== 'university') {
            return res.status(400).json({
              error: 'Invalid Organization Type',
              message: 'Students and TPOs can only belong to university organizations'
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

      if (organization.type !== 'university') {
        return res.status(400).json({
          error: 'Invalid Organization Type',
          message: 'TPOs can only belong to university organizations'
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

          if (organization.type !== 'university') {
            return res.status(400).json({
              error: 'Invalid Organization Type',
              message: 'TPOs can only belong to university organizations'
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
}

module.exports = new AdminController();

