// server/src/routes/users.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requireOwnership } = require('../middleware/rbac');
const userController = require('../controllers/userController');
const upload = require('../middleware/upload');
const { createUploadMiddleware, FILE_TYPES, handleMulterError } = require('../config/multer');
const adminController = require('../controllers/adminController');

const router = express.Router();

const uploadExcel = createUploadMiddleware('file', {
  maxSize: 5 * 1024 * 1024,
  allowedTypes: FILE_TYPES.SPREADSHEETS.mimeTypes,
  allowedExtensions: FILE_TYPES.SPREADSHEETS.extensions
});

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
  // School leadership is scoped to its own organization inside the controller,
  // which forces the filter rather than trusting the query string.
  requireRole('admin', 'tpo', 'principal', 'school_admin', 'career_counselor', 'teacher'),
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

/**
 * @swagger
 * /api/users/import:
 *   post:
 *     summary: Bulk-import students from an Excel sheet into your institution
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
// The bulk importer works, but it lived only on the admin router behind
// `requireRole('admin')` — so the people who actually onboard a cohort, the
// TPO and the school office, could not use it and had to ask an EduMapping
// administrator to load their students for them.
router.post('/import',
  authenticateToken,
  requireRole('admin', 'tpo', 'principal', 'school_admin'),
  uploadExcel,
  handleMulterError,
  (req, res, next) => {
    // Anyone but an admin imports into their OWN institution, forced here
    // rather than read from the request — otherwise a TPO could load students
    // into somebody else's college.
    if (req.user.role !== 'admin') {
      if (!req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Your account is not attached to an institution'
        });
      }
      req.body.organizationId = req.user.organizationId;
    }
    return adminController.importStudentsFromExcel(req, res, next);
  }
);

/**
 * @swagger
 * /api/users/{id}/placement-sanction:
 *   patch:
 *     summary: Block, remove or reinstate a student's placement participation
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id(\\d+)/placement-sanction',
  authenticateToken,
  requireRole('tpo', 'admin'),
  [
    body('sanction').isIn(['none', 'blocked', 'removed'])
      .withMessage('sanction must be none, blocked or removed'),
    // Required in both directions — an unexplained reinstatement is as unhelpful
    // as an unexplained sanction.
    body('reason').isString().trim().isLength({ min: 3, max: 2000 })
      .withMessage('A reason is required'),
    body('until').optional({ nullable: true }).isISO8601()
      .withMessage('until must be a date')
  ],
  userController.setPlacementSanction
);

module.exports = router;