// server/src/routes/achievements.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const achievementController = require('../controllers/achievementController');

const router = express.Router();

/**
 * @swagger
 * /api/achievements:
 *   get:
 *     summary: Get all achievements
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, achievementController.getAllAchievements);

/**
 * @swagger
 * /api/achievements:
 *   post:
 *     summary: Create a new achievement
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', 
  authenticateToken, 
  [
    body('title').notEmpty().withMessage('Title is required').isLength({ min: 3, max: 255 }).withMessage('Title must be between 3 and 255 characters'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
    body('achievementType').isIn(['academic', 'project', 'certification', 'competition', 'publication', 'other']).withMessage('Invalid achievement type'),
    body('issuingOrganization').optional().isLength({ max: 255 }).withMessage('Issuing organization must be less than 255 characters'),
    body('issueDate').optional().isISO8601().withMessage('Issue date must be in valid date format (YYYY-MM-DD)'),
    body('expiryDate').optional().isISO8601().withMessage('Expiry date must be in valid date format (YYYY-MM-DD)'),
    body('credentialUrl').optional().isURL().withMessage('Credential URL must be a valid URL')
  ],
  achievementController.createAchievement
);

/**
 * @swagger
 * /api/achievements/{id}:
 *   get:
 *     summary: Get achievement by ID
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateToken, achievementController.getAchievementById);

/**
 * @swagger
 * /api/achievements/{id}:
 *   put:
 *     summary: Update achievement
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', 
  authenticateToken, 
  [
    body('title').optional().isLength({ min: 3, max: 255 }),
    body('description').optional().isLength({ max: 1000 }),
    body('achievementType').optional().isIn(['academic', 'project', 'certification', 'competition', 'publication', 'other']),
    body('issuingOrganization').optional().isLength({ max: 255 }),
    body('issueDate').optional().isISO8601(),
    body('expiryDate').optional().isISO8601(),
    body('credentialUrl').optional().isURL()
  ],
  achievementController.updateAchievement
);

/**
 * @swagger
 * /api/achievements/{id}:
 *   delete:
 *     summary: Delete achievement
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateToken, achievementController.deleteAchievement);

/**
 * @swagger
 * /api/achievements/user/{userId}:
 *   get:
 *     summary: Get achievements for a specific user
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
router.get('/user/:userId', authenticateToken, achievementController.getUserAchievements);

/**
 * @swagger
 * /api/achievements/{id}/verify:
 *   patch:
 *     summary: Verify/unverify an achievement
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 */
// School staff verify their own students' achievements as a TPO does for a
// college; the controller limits every one of them to their own institution.
router.patch('/:id/verify', 
  authenticateToken, 
  requireRole('admin', 'tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'),
  [
    body('isVerified').isBoolean()
  ],
  achievementController.verifyAchievement
);

module.exports = router;