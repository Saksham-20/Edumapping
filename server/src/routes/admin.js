// server/src/routes/admin.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const adminController = require('../controllers/adminController');
const adminOrganizationController = require('../controllers/adminOrganizationController');
const { createUploadMiddleware, FILE_TYPES, handleMulterError } = require('../config/multer');

const router = express.Router();

const uploadExcel = createUploadMiddleware('file', {
  maxSize: 5 * 1024 * 1024,
  allowedTypes: FILE_TYPES.SPREADSHEETS.mimeTypes,
  allowedExtensions: FILE_TYPES.SPREADSHEETS.extensions
});

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users', adminController.createUser);

/**
 * @swagger
 * /api/admin/users/:id:
 *   put:
 *     summary: Update user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:id', adminController.updateUser);

/**
 * @swagger
 * /api/admin/users/:id:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/users/:id', adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/:id:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @swagger
 * /api/admin/users/bulk:
 *   post:
 *     summary: Bulk update users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users/bulk', adminController.bulkUpdateUsers);

/**
 * @swagger
 * /api/admin/students/import:
 *   post:
 *     summary: Import students from Excel (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/students/import', uploadExcel, handleMulterError, adminController.importStudentsFromExcel);

/**
 * @swagger
 * /api/admin/tpos:
 *   get:
 *     summary: Get all TPOs (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tpos', adminController.getAllTPOs);

/**
 * @swagger
 * /api/admin/tpos:
 *   post:
 *     summary: Create TPO (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tpos', adminController.createTPO);

/**
 * @swagger
 * /api/admin/tpos/:id:
 *   put:
 *     summary: Update TPO (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/tpos/:id', adminController.updateTPO);

/**
 * @swagger
 * /api/admin/tpos/:id:
 *   delete:
 *     summary: Delete TPO (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/tpos/:id', adminController.deleteTPO);

/**
 * @swagger
 * /api/admin/organizations:
 *   get:
 *     summary: Get all organizations (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/organizations', async (req, res, next) => {
  try {
    const { type } = req.query;
    if (type === 'university') {
      return adminOrganizationController.getAllUniversities(req, res, next);
    } else if (type === 'company') {
      return adminOrganizationController.getAllCompanies(req, res, next);
    } else if (type === 'school') {
      return adminOrganizationController.getAllSchools(req, res, next);
    } else if (type === 'college') {
      return adminOrganizationController.getAllColleges(req, res, next);
    } else {
      // Get all organizations
      const { Organization } = require('../models');
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: organizations } = await Organization.findAndCountAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['name', 'ASC']]
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
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/organizations:
 *   post:
 *     summary: Create organization (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/organizations', adminOrganizationController.createOrganization);

/**
 * @swagger
 * /api/admin/organizations/:id:
 *   put:
 *     summary: Update organization (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/organizations/:id', adminOrganizationController.updateOrganization);

/**
 * @swagger
 * /api/admin/organizations/:id:
 *   delete:
 *     summary: Delete organization (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/organizations/:id', adminOrganizationController.deleteOrganization);

/**
 * @swagger
 * /api/admin/organizations/universities:
 *   get:
 *     summary: Get all universities (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/organizations/universities', adminOrganizationController.getAllUniversities);

/**
 * @swagger
 * /api/admin/organizations/companies:
 *   get:
 *     summary: Get all companies (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/organizations/companies', adminOrganizationController.getAllCompanies);

/**
 * @swagger
 * /api/admin/organizations/schools:
 *   get:
 *     summary: Get all schools (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/organizations/schools', adminOrganizationController.getAllSchools);

/**
 * @swagger
 * /api/admin/organizations/bulk:
 *   post:
 *     summary: Bulk update organizations (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/organizations/bulk', adminOrganizationController.bulkUpdateOrganizations);

/**
 * @swagger
 * /api/admin/organizations/:id/verify:
 *   patch:
 *     summary: Verify/unverify organization (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/organizations/:id/verify', adminOrganizationController.verifyOrganization);

/**
 * @swagger
 * /api/admin/organizations/:id:
 *   get:
 *     summary: Get organization by ID (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/organizations/:id', adminOrganizationController.getOrganizationById);

router.get('/recruiters/:id/permissions', adminController.getRecruiterPermissions);
router.put('/recruiters/:id/allowed-organizations', adminController.setRecruiterAllowedOrganizations);

module.exports = router;

