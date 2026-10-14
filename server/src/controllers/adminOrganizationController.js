// server/src/controllers/adminOrganizationController.js
const { Organization, User, Job, Application, StudentProfile, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { cascadeOrganizationDecision } = require('../utils/approvalCascade');

const ORG_TYPES = ['university', 'college', 'company', 'school'];

// Fields an admin may change through the generic edit form. Approval state is
// left out on purpose: it goes through the approvals flow, which cascades to
// the organisation's staff and writes the audit trail. Passing the whole body
// to update() let an edit silently approve or reject an institution.
const EDITABLE_FIELDS = [
  'name', 'type', 'domain', 'contactEmail', 'contactPhone', 'website', 'address',
  'logoUrl', 'region', 'state', 'city', 'zone', 'workMode', 'locations'
];

const FIELD_LABELS = { name: 'Name', type: 'Type', domain: 'Domain', contactEmail: 'Contact email' };

/** Same normalisation as the model's domain setter, for duplicate lookups. */
const bareDomain = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^.*@/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

/** Sequelize validation errors as the house 400 shape, keyed by field. */
const sequelizeValidation = (res, error) => {
  const details = (error.errors || []).map((e) => ({ field: e.path, message: e.message }));
  return res.status(400).json({
    error: 'Validation Error',
    message: details.map((d) => d.message).join('. ') || 'Some details need fixing.',
    details
  });
};

const auditOrg = (req, action, organization, extra = {}) =>
  AuditLog.create({
    userId: req.user.id,
    action,
    entityType: 'organization',
    entityId: organization.id,
    newValues: { name: organization.name, type: organization.type, ...extra },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent')
  }).catch((err) => logger.error('Audit log failed', err));

const duplicateDomain = (res, domain) =>
  res.status(400).json({
    error: 'Validation Error',
    message: `Another organization already uses the domain ${domain}. Each organization needs its own email domain.`,
    details: [{ field: 'domain', message: `${domain} is already registered to another organization` }]
  });

class AdminOrganizationController {
  // Create organization
  async createOrganization(req, res, next) {
    try {
      const { name, type, domain, contactEmail, contactPhone, website, address } = req.body;

      // Name the missing fields, so the form can mark each one.
      const missing = Object.keys(FIELD_LABELS).filter((k) => !String(req.body[k] || '').trim());
      if (missing.length) {
        const details = missing.map((field) => ({ field, message: `${FIELD_LABELS[field]} is required` }));
        return res.status(400).json({
          error: 'Validation Error',
          message: `Fill in: ${missing.map((f) => FIELD_LABELS[f].toLowerCase()).join(', ')}`,
          details
        });
      }

      // `college` is a valid organization type (the enum has carried it since
      // migration 27) but was missing here, so an admin could not create one.
      if (!ORG_TYPES.includes(type)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Choose whether this is a university, college, company or school',
          details: [{ field: 'type', message: 'Choose a type' }]
        });
      }

      // Compare in the stored form: "College.EDU " and "college.edu" are the
      // same institution, and the raw lookup missed that.
      const existingOrg = await Organization.findOne({ where: { domain: bareDomain(domain) } });
      if (existingOrg) return duplicateDomain(res, bareDomain(domain));

      // Create organization
      const organization = await Organization.create({
        name,
        type,
        domain,
        contactEmail,
        contactPhone,
        website: website || null, // Allow null for optional website
        address: address || null, // Allow null for optional address
        // Location drives the recruiter region/state/city filters; the form
        // now collects it.
        ...Object.fromEntries(
          ['region', 'state', 'city'].map((k) => [k, String(req.body[k] || '').trim() || null])
        ),
        isVerified: true, // Admin-created organizations are verified
        approvalStatus: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date()
      }, {
        validate: true // Ensure validation runs
      });

      auditOrg(req, 'organization_created', organization, { domain: organization.domain });

      res.status(201).json({
        message: 'Organization created successfully',
        organization
      });
    } catch (error) {
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return duplicateDomain(res, bareDomain(req.body.domain));
      }
      next(error);
    }
  }

  // Update organization
  async updateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = Object.fromEntries(
        Object.entries(req.body || {}).filter(([key]) => EDITABLE_FIELDS.includes(key))
      );

      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      if (updateData.type !== undefined && !ORG_TYPES.includes(updateData.type)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Choose whether this is a university, college, company or school',
          details: [{ field: 'type', message: 'Choose a type' }]
        });
      }
      // Required fields may be changed but not emptied.
      const emptied = ['name', 'domain', 'contactEmail'].filter(
        (k) => k in updateData && !String(updateData[k] || '').trim()
      );
      if (emptied.length) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${FIELD_LABELS[emptied[0]]} cannot be empty`,
          details: emptied.map((field) => ({ field, message: `${FIELD_LABELS[field]} is required` }))
        });
      }

      // Check if domain is being changed and if new domain already exists
      if (updateData.domain && bareDomain(updateData.domain) !== organization.domain) {
        const existingOrg = await Organization.findOne({
          where: { domain: bareDomain(updateData.domain), id: { [Op.ne]: organization.id } }
        });
        if (existingOrg) return duplicateDomain(res, bareDomain(updateData.domain));
      }

      await organization.update(updateData);
      auditOrg(req, 'organization_updated', organization, { fields: Object.keys(updateData) });

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
      if (error.name === 'SequelizeValidationError') return sequelizeValidation(res, error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return duplicateDomain(res, bareDomain(req.body?.domain));
      }
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
          // Deactivating blocks sign-in for every account attached to it, so
          // it is refused while any remain. The old text pointed at "hard
          // delete", which no screen offers.
          const parts = [
            userCount ? `${userCount} account${userCount === 1 ? '' : 's'}` : null,
            jobCount ? `${jobCount} job${jobCount === 1 ? '' : 's'}` : null
          ].filter(Boolean);
          return res.status(400).json({
            error: 'Cannot Delete Organization',
            message: `${organization.name} still has ${parts.join(' and ')}. Deactivating it would lock all of them out, so it can only be deactivated once they are moved or removed. Use Unverify to remove its verified badge instead.`,
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
        auditOrg(req, 'organization_deactivated', organization);
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

      // The "universities" tab is every higher-education institution. Colleges
      // are their own enum value, and filtering on 'university' alone hid every
      // college an admin created or approved from the console.
      const whereClause = { type: { [Op.in]: ['university', 'college'] } };

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

  // Get all colleges
  async getAllColleges(req, res, next) {
    try {
      const { page = 1, limit = 20, search, verified } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = { type: 'college' };

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { domain: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (verified !== undefined) {
        whereClause.isVerified = verified === 'true';
      }

      const { count, rows: colleges } = await Organization.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['name', 'ASC']]
      });

      res.json({
        message: 'Colleges retrieved successfully',
        colleges,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          hasMore: offset + colleges.length < count
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

  /**
   * Verify/unverify an organization.
   *
   * Verifying also approves it — and, since this is the admin's approval step
   * for an institution, approves the staff who were waiting on it: the TPO who
   * registered a new college, a school's principal, a company's recruiters.
   * It used to approve only the organization, leaving its TPO pending (and
   * unable to sign in) behind an approved institution with nobody to run it.
   *
   * Unverifying only clears the badge; it does not revoke an approval.
   */
  async verifyOrganization(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { isVerified } = req.body;

      const organization = await Organization.findByPk(id, { transaction });
      if (!organization) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      const verified = isVerified === true || isVerified === 'true';
      const newlyApproved = verified && organization.approvalStatus !== 'approved';

      await organization.update(
        {
          isVerified: verified,
          ...(newlyApproved
            ? { approvalStatus: 'approved', approvedBy: req.user.id, approvedAt: new Date() }
            : {})
        },
        { transaction }
      );

      // Run on every verify, not only the first approval: an organization that
      // was approved by the old path may still have staff stuck in pending,
      // and re-verifying is the natural thing for an admin to try.
      const usersUpdated = verified
        ? await cascadeOrganizationDecision({
            User,
            organization,
            action: 'approve',
            approverId: req.user.id,
            transaction
          })
        : 0;

      await transaction.commit();

      AuditLog.create({
        userId: req.user.id,
        action: verified ? 'organization_verified' : 'organization_unverified',
        entityType: 'organization',
        entityId: organization.id,
        newValues: { name: organization.name, type: organization.type, staffAccountsApproved: usersUpdated },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch((err) => logger.error('Audit log failed', err));

      res.json({
        message: `Organization ${verified ? 'verified' : 'unverified'} successfully`,
        organization,
        usersUpdated
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
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

      // Descriptive fields only. Approval goes through the approvals flow,
      // which also cascades to the organisation's staff and audit-logs the
      // decision; letting it through here bypassed both.
      const BULK_FIELDS = ['region', 'state', 'city', 'zone', 'workMode', 'isVerified', 'website', 'contactEmail', 'contactPhone'];
      const safeUpdates = Object.fromEntries(Object.entries(updates).filter(([k]) => BULK_FIELDS.includes(k)));
      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Only these fields can be bulk-updated: ${BULK_FIELDS.join(', ')}`
        });
      }

      // Update organizations
      const [affectedRows] = await Organization.update(safeUpdates, {
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



