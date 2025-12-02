// server/src/routes/users.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requireOwnership } = require('../middleware/rbac');
const userController = require('../controllers/userController');
const upload = require('../middleware/upload');

const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', authenticateToken, userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/profile',
  authenticateToken,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
    body('phone').optional().matches(/^[\+]?[\d\s-]{5,20}$/)
  ],
  userController.updateProfile
);

/**
 * @swagger
 * /api/users/profile/picture:
 *   post:
 *     summary: Upload profile picture
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 */
router.post('/profile/picture',
  authenticateToken,
  upload.uploadProfilePicture,
  userController.uploadProfilePicture
);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/',
  authenticateToken,
  requireRole('admin', 'tpo'),
  userController.getAllUsers
);

/**
 * @swagger
 * /api/users/role/{role}:
 *   get:
 *     summary: Get users by role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/role/:role',
  authenticateToken,
  requireRole('admin', 'tpo', 'recruiter'),
  userController.getUsersByRole
);

/**
 * @swagger
 * /api/users/top-candidates:
 *   get:
 *     summary: Get top candidates for recruiters
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/top-candidates',
  authenticateToken,
  requireRole('recruiter', 'admin'),
  userController.getTopCandidates
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateToken, userController.getProfile);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Toggle user status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/status',
  authenticateToken,
  requireRole('admin'),
  userController.toggleUserStatus
);

module.exports = router;