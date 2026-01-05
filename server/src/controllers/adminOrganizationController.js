// server/src/controllers/adminOrganizationController.js
const { Organization, User, Job, Application, StudentProfile } = require('../models');
const { Op } = require('sequelize');

class AdminOrganizationController {
  // Create organization
  async createOrganization(req, res, next) {
    try {
      const { name, type, domain, contactEmail, contactPhone, website, address } = req.body;

      // Validate required fields
      if (!name || !type || !domain || !contactEmail) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Name, type, domain, and contact email are required'
        });
      }

      // Validate type
      if (!['university', 'company', 'school'].includes(type)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Type must be either "university", "company", or "school"'
        });
      }

      // Check if organization with same domain already exists
      const existingOrg = await Organization.findOne({ where: { domain } });
      if (existingOrg) {
        return res.status(400).json({
          error: 'Domain Already Exists',
          message: 'An organization with this domain already exists'
        });
      }

      // Create organization
      const organization = await Organization.create({
        name,
        type,
        domain,
        contactEmail,
        contactPhone,
        website: website || null, // Allow null for optional website
        address: address || null, // Allow null for optional address
        isVerified: true, // Admin-created organizations are verified
        approvalStatus: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date()
      }, {
        validate: true // Ensure validation runs
      });

      res.status(201).json({
        message: 'Organization created successfully',
        organization
      });
    } catch (error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message).join(', ');
        return res.status(400).json({
          error: 'Validation Error',
          message: validationErrors || 'Invalid organization data'
        });
      }
      // Handle unique constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          error: 'Duplicate Entry',
          message: 'An organization with this domain already exists'
        });
      }
      next(error);
    }
  }

  // Update organization
  async updateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      // Check if domain is being changed and if new domain already exists
      if (updateData.domain && updateData.domain !== organization.domain) {
        const existingOrg = await Organization.findOne({
          where: { domain: updateData.domain }
        });
        if (existingOrg) {
          return res.status(400).json({
            error: 'Domain Already Exists',
            message: 'An organization with this domain already exists'
          });
        }
      }

      await organization.update(updateData);

      const updatedOrg = await Organization.findByPk(id, {
        include: [
          {
            model: User,
            as: 'users',
            attributes: ['id', 'email', 'firstName', 'lastName', 'role']
          }
        ]
      });

      res.json({
        message: 'Organization updated successfully',
        organization: updatedOrg
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete organization
  async deleteOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { hardDelete, migrateToOrgId } = req.query;

      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      // Check for associated users
      const userCount = await User.count({ where: { organizationId: id } });
      const jobCount = await Job.count({ where: { organizationId: id } });

      if (userCount > 0 || jobCount > 0) {
        if (hardDelete !== 'true' && !migrateToOrgId) {
          return res.status(400).json({
            error: 'Cannot Delete Organization',
            message: `This organization has ${userCount} user(s) and ${jobCount} job(s). Please migrate users to another organization or use hard delete.`,
            userCount,
            jobCount
          });
        }

        // Migrate users if migrateToOrgId is provided
        if (migrateToOrgId) {
          const targetOrg = await Organization.findByPk(migrateToOrgId);
          if (!targetOrg) {
            return res.status(400).json({
              error: 'Invalid Target Organization',
              message: 'Target organization not found'
            });
          }

          // Validate organization types match for users
          if (organization.type === 'university' && targetOrg.type !== 'university') {
            return res.status(400).json({
              error: 'Invalid Migration',
              message: 'Cannot migrate university users to a non-university organization'
            });
          }

          if (organization.type === 'company' && targetOrg.type !== 'company') {
            return res.status(400).json({
              error: 'Invalid Migration',
              message: 'Cannot migrate company users to a non-company organization'
            });
          }

          if (organization.type === 'school' && targetOrg.type !== 'school') {
            return res.status(400).json({
              error: 'Invalid Migration',
              message: 'Cannot migrate school users to a non-school organization'
            });
          }

          await User.update(
            { organizationId: migrateToOrgId },
            { where: { organizationId: id } }
          );
        }
      }

      if (hardDelete === 'true') {
        await organization.destroy();
        return res.json({
          message: 'Organization deleted permanently'
        });
      } else {
        await organization.update({ isVerified: false, approvalStatus: 'rejected' });
        return res.json({
          message: 'Organization deactivated successfully'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Get organization by ID
  async getOrganizationById(req, res, next) {
    try {
      const { id } = req.params;

      const organization = await Organization.findByPk(id, {
        include: [
          {
            model: User,
            as: 'users',
            attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive'],
            include: [
              {
                model: StudentProfile,
                as: 'studentProfile',
                attributes: ['id', 'course', 'branch', 'placementStatus']
              }
            ]
          }
        ]
      });

      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      // Get statistics
      const stats = {
        totalUsers: await User.count({ where: { organizationId: id } }),
        students: await User.count({ where: { organizationId: id, role: 'student' } }),
        tpos: await User.count({ where: { organizationId: id, role: 'tpo' } }),
        recruiters: await User.count({ where: { organizationId: id, role: 'recruiter' } }),
        jobs: await Job.count({ where: { organizationId: id } }),
        placements: organization.type === 'university' 
          ? await StudentProfile.count({
              include: [{
                model: User,
                as: 'user',
                where: { organizationId: id },
                attributes: []
              }],
              where: { placementStatus: 'placed' }
            })
          : null
      };

      res.json({
        message: 'Organization retrieved successfully',
        organization: {
          ...organization.toJSON(),
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all universities
  async getAllUniversities(req, res, next) {
    try {
      const { page = 1, limit = 20, search, verified } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = { type: 'university' };

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { domain: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (verified !== undefined) {
        whereClause.isVerified = verified === 'true';
      }

      const { count, rows: universities } = await Organization.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['name', 'ASC']]
      });

      // Get stats for each university
      const universitiesWithStats = await Promise.all(
        universities.map(async (university) => {
          const stats = {
            students: await User.count({ where: { organizationId: university.id, role: 'student' } }),
            tpos: await User.count({ where: { organizationId: university.id, role: 'tpo' } }),
            placements: await StudentProfile.count({
              include: [{
                model: User,
                as: 'user',
                where: { organizationId: university.id },
                attributes: []
              }],
              where: { placementStatus: 'placed' }
            })
          };
          return { ...university.toJSON(), stats };
        })
      );

      res.json({
        message: 'Universities retrieved successfully',
        universities: universitiesWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          hasMore: offset + universities.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all companies
  async getAllCompanies(req, res, next) {
    try {
      const { page = 1, limit = 20, search, verified } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = { type: 'company' };

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { domain: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (verified !== undefined) {
        whereClause.isVerified = verified === 'true';
      }

      const { count, rows: companies } = await Organization.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['name', 'ASC']]
      });

      // Get stats for each company
      const companiesWithStats = await Promise.all(
        companies.map(async (company) => {
          const stats = {
            recruiters: await User.count({ where: { organizationId: company.id, role: 'recruiter' } }),
            jobs: await Job.count({ where: { organizationId: company.id } }),
            applications: await Application.count({
              include: [{
                model: Job,
                as: 'job',
                where: { organizationId: company.id },
                attributes: []
              }]
            })
          };
          return { ...company.toJSON(), stats };
        })
      );

      res.json({
        message: 'Companies retrieved successfully',
        companies: companiesWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          hasMore: offset + companies.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all schools
  async getAllSchools(req, res, next) {
    try {
      const { page = 1, limit = 20, search, verified } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = { type: 'school' };

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { domain: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (verified !== undefined) {
        whereClause.isVerified = verified === 'true';
      }

      const { count, rows: schools } = await Organization.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['name', 'ASC']]
      });

      // Get stats for each school
      const schoolsWithStats = await Promise.all(
        schools.map(async (school) => {
          const stats = {
            students: await User.count({ where: { organizationId: school.id, role: 'student' } })
          };
          return { ...school.toJSON(), stats };
        })
      );

      res.json({
        message: 'Schools retrieved successfully',
        schools: schoolsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          hasMore: offset + schools.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Verify/unverify organization
  async verifyOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { isVerified } = req.body;

      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      const verified = isVerified === true || isVerified === 'true';
      
      await organization.update({
        isVerified: verified,
        approvalStatus: verified ? 'approved' : organization.approvalStatus, // Only change to approved if verifying, don't change if unverifying
        approvedBy: verified ? req.user.id : organization.approvedBy,
        approvedAt: verified ? new Date() : organization.approvedAt
      });

      res.json({
        message: `Organization ${verified ? 'verified' : 'unverified'} successfully`,
        organization
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update organizations
  async bulkUpdateOrganizations(req, res, next) {
    try {
      const { organizationIds, updates } = req.body;

      if (!organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Organization IDs array is required'
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Updates object is required'
        });
      }

      // Update organizations
      const [affectedRows] = await Organization.update(updates, {
        where: {
          id: {
            [Op.in]: organizationIds.map(id => parseInt(id))
          }
        }
      });

      res.json({
        message: `${affectedRows} organization(s) updated successfully`,
        affectedRows
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminOrganizationController();



