// server/src/routes/organizations.js
const express = require('express');
const { Organization, User } = require('../models');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { ORGANIZATION_TYPES } = require('../utils/constants');

// The `type` query values this endpoint accepts — every member of the
// organizations type ENUM, derived from the constant so the two cannot drift.
const ORGANIZATION_TYPE_VALUES = Object.values(ORGANIZATION_TYPES);

const router = express.Router();

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: Get all organizations
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [university, company]
 *         description: Filter by organization type
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      type,
      verified = 'true', // Default to only verified organizations
      page = 1,
      // This list feeds the registration dropdowns, which have no paging UI and
      // filter client-side. A low cap silently truncated them, making every
      // institution past the cut-off impossible to sign up under.
      limit = 500
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Every value in the organizations type ENUM. Omitting `school` and
    // `college` (added by migrations 27 and 32) made ?type= silently return
    // the unfiltered list for exactly the two org types the school and college
    // signup flows ask for.
    if (type && ORGANIZATION_TYPE_VALUES.includes(type)) {
      whereClause.type = type;
    }

    // Filter by verification status
    if (verified !== 'all') {
      whereClause.isVerified = verified === 'true';
    }

    const { count, rows: organizations } = await Organization.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']],
      attributes: [
        'id',
        'name',
        'type',
        'domain',
        'website',
        'isVerified',
        // The signup forms filter on this. Leaving it out made their
        // `approvalStatus === 'approved'` check compare against undefined,
        // so unapproved organizations passed straight through.
        'approvalStatus',
        'createdAt'
      ]
    });

    res.json({
      message: 'Organizations retrieved successfully',
      organizations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalItems: count,
        hasMore: offset + organizations.length < count
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *       404:
 *         description: Organization not found
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await Organization.findByPk(id, {
      attributes: [
        'id',
        'name',
        'type',
        'domain',
        'website',
        'contactEmail',
        'contactPhone',
        'address',
        'isVerified',
        'createdAt'
      ]
    });

    if (!organization) {
      return res.status(404).json({
        error: 'Organization Not Found',
        message: 'Organization not found'
      });
    }

    res.json({
      message: 'Organization retrieved successfully',
      organization
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/organizations/register:
 *   post:
 *     summary: Register new organization (Public - requires approval)
 *     tags: [Organizations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - domain
 *               - contactEmail
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [university, company]
 *               domain:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization registered successfully (pending approval)
 *       400:
 *         description: Validation error
 */
router.post('/register', async (req, res, next) => {
  try {
    const clean = (v) => (typeof v === 'string' ? v.trim() : v);
    const name = clean(req.body.name);
    const type = clean(req.body.type);
    // Same normalisation as the model setter, so the duplicate check below
    // compares what will actually be stored.
    const domain = clean(req.body.domain)
      ? String(req.body.domain)
          .trim()
          .toLowerCase()
          .replace(/^.*@/, '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '')
      : '';
    const contactEmail = clean(req.body.contactEmail);
    const contactPhone = clean(req.body.contactPhone) || null;
    const website = clean(req.body.website) || null;
    const address = clean(req.body.address) || null;

    // Validate required fields, naming the missing ones.
    const missing = [
      !name && { field: 'name', message: 'Institution name is required' },
      !type && { field: 'type', message: 'Institution type is required' },
      !domain && { field: 'domain', message: 'Email domain is required' },
      !contactEmail && { field: 'contactEmail', message: 'Contact email is required' }
    ].filter(Boolean);
    if (missing.length) {
      return res.status(400).json({
        error: 'Validation Error',
        message: missing[0].message,
        details: missing
      });
    }

    // Validate type. `college` is a member of the enum (migration 32) and the
    // college signup screen sends it, but this list predated it, so every
    // college self-registration was rejected here.
    if (!['university', 'college', 'company', 'school'].includes(type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be one of "university", "college", "company" or "school"'
      });
    }

    // Signup is two requests: create the organization, then the first user. If
    // the second one failed (weak password, email taken, a dropped
    // connection), the organization was left behind with nobody attached, and
    // the retry hit "already exists" — the institution could never sign up
    // again without an admin deleting the orphan. An organization that is
    // still pending, has the same name and type, and has no users yet is that
    // orphan: it is reused (with the newly submitted details) instead of
    // refused. Anything approved, or with even one account, still 409s, so
    // this cannot be used to take over a real institution.
    const escapedName = String(name).replace(/[\\%_]/g, (c) => `\\${c}`);
    const sameName = await Organization.findOne({ where: { name: { [Op.iLike]: escapedName } } });
    let orphan = null;
    if (sameName && sameName.approvalStatus === 'pending' && sameName.type === type) {
      const members = await User.count({ where: { organizationId: sameName.id } });
      if (members === 0) orphan = sameName;
    }

    // Check if organization with same domain already exists
    const existingOrgByDomain = await Organization.findOne({ where: { domain } });
    if (existingOrgByDomain && (!orphan || existingOrgByDomain.id !== orphan.id)) {
      return res.status(409).json({
        error: 'Organization Already Exists',
        message: `An organization with the domain "${domain}" is already registered. Please use a different domain or contact support if this is your organization.`
      });
    }

    // Check if organization with same name already exists (case-insensitive)
    if (sameName && !orphan) {
      return res.status(409).json({
        error: 'Organization Already Exists',
        message: `An organization with the name "${sameName.name}" is already registered. Please use a different name or contact support if this is your organization.`
      });
    }

    if (orphan) {
      // Approval fields are restated, not left as they were: this path must
      // never hand back anything but a pending, unverified organization.
      await orphan.update({
        domain,
        contactEmail,
        contactPhone,
        website,
        address,
        isVerified: false,
        approvalStatus: 'pending'
      });
      logger.info('Reused orphaned pending organization on signup retry', { organizationId: orphan.id });
      return res.status(200).json({
        message: 'Organization registered successfully. It is pending admin approval.',
        organization: {
          id: orphan.id,
          name: orphan.name,
          type: orphan.type,
          domain: orphan.domain,
          approvalStatus: orphan.approvalStatus
        }
      });
    }

    // Fix sequence if needed before creating (handles out-of-sync sequences from seeders)
    // This is a safety measure - the migration should fix it permanently
    try {
      const { sequelize } = require('../models');
      await sequelize.query(`
        SELECT setval(
          pg_get_serial_sequence('organizations', 'id'),
          COALESCE((SELECT MAX(id) FROM organizations), 0) + 1,
          false
        );
      `);
    } catch (seqError) {
      // Log but don't fail - sequence might be fine or will be fixed by migration
      logger.warn('Could not auto-fix organizations sequence', { error: seqError.message });
      logger.warn('Please run migration 25-fix-organizations-sequence.js to fix this permanently');
    }

    // Create organization with pending approval
    const organization = await Organization.create({
      name,
      type,
      domain,
      contactEmail,
      contactPhone,
      website,
      address,
      isVerified: false,
      approvalStatus: 'pending' // Requires admin approval
    });

    res.status(201).json({
      message: 'Organization registered successfully. It is pending admin approval.',
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        domain: organization.domain,
        approvalStatus: organization.approvalStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create new organization (Admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - domain
 *               - contactEmail
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [university, company]
 *               domain:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const clean = (v) => (typeof v === 'string' ? v.trim() : v);
    const name = clean(req.body.name);
    const type = clean(req.body.type);
    // Same normalisation as the model setter, so the duplicate check below
    // compares what will actually be stored.
    const domain = clean(req.body.domain)
      ? String(req.body.domain)
          .trim()
          .toLowerCase()
          .replace(/^.*@/, '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '')
      : '';
    const contactEmail = clean(req.body.contactEmail);
    const contactPhone = clean(req.body.contactPhone) || null;
    const website = clean(req.body.website) || null;
    const address = clean(req.body.address) || null;

    // Validate required fields, naming the missing ones.
    const missing = [
      !name && { field: 'name', message: 'Institution name is required' },
      !type && { field: 'type', message: 'Institution type is required' },
      !domain && { field: 'domain', message: 'Email domain is required' },
      !contactEmail && { field: 'contactEmail', message: 'Contact email is required' }
    ].filter(Boolean);
    if (missing.length) {
      return res.status(400).json({
        error: 'Validation Error',
        message: missing[0].message,
        details: missing
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

    const organization = await Organization.create({
      name,
      type,
      domain,
      contactEmail,
      contactPhone,
      website,
      address,
      isVerified: false, // New organizations need verification
      approvalStatus: 'pending' // All new organizations require admin approval
    });

    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        domain: organization.domain,
        isVerified: organization.isVerified
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/organizations/{id}/verify:
 *   patch:
 *     summary: Verify organization (Admin only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization verified successfully
 *       404:
 *         description: Organization not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.patch('/:id/verify', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await Organization.findByPk(id);
    if (!organization) {
      return res.status(404).json({
        error: 'Organization Not Found',
        message: 'Organization not found'
      });
    }

    await organization.update({ isVerified: true });

    res.json({
      message: 'Organization verified successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        isVerified: organization.isVerified
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;