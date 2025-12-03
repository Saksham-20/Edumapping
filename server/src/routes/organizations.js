// server/src/routes/organizations.js
const express = require('express');
const { Organization } = require('../models');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

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
      limit = 50 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Filter by type if provided
    if (type && ['university', 'company'].includes(type)) {
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
    const {
      name,
      type,
      domain,
      contactEmail,
      contactPhone,
      website,
      address
    } = req.body;

    // Validate required fields
    if (!name || !type || !domain || !contactEmail) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name, type, domain, and contact email are required'
      });
    }

    // Validate type
    if (!['university', 'company'].includes(type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Type must be either "university" or "company"'
      });
    }

    // Check if organization with same domain already exists
    const existingOrgByDomain = await Organization.findOne({ where: { domain } });
    if (existingOrgByDomain) {
      return res.status(409).json({
        error: 'Organization Already Exists',
        message: `An organization with the domain "${domain}" is already registered. Please use a different domain or contact support if this is your organization.`
      });
    }

    // Check if organization with same name already exists (case-insensitive)
    const existingOrgByName = await Organization.findOne({
      where: {
        name: { [Op.iLike]: name }
      }
    });
    if (existingOrgByName) {
      return res.status(409).json({
        error: 'Organization Already Exists',
        message: `An organization with the name "${existingOrgByName.name}" is already registered. Please use a different name or contact support if this is your organization.`
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
    const {
      name,
      type,
      domain,
      contactEmail,
      contactPhone,
      website,
      address
    } = req.body;

    // Validate required fields
    if (!name || !type || !domain || !contactEmail) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name, type, domain, and contact email are required'
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