// server/src/routes/notifications.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// Announcements fan out to a whole campus, so a stuck button or a script must
// not be able to send fifty of them. Ten an hour per sender is generous for a
// placement cell. Keyed on the authenticated user (this runs after
// authenticateToken), not the IP — a college NAT puts every officer on one.
const announceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.ANNOUNCE_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `announce_user_${req.user.id}`,
  handler: (req, res) =>
    res.status(429).json({
      error: 'Too Many Announcements',
      message: 'You have sent too many announcements in the last hour. Please wait before sending another.'
    })
});

const audienceValidators = [
  body('audience').optional().isObject().withMessage('audience must be an object'),
  body('audience.graduationYear')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1990, max: 2100 }).withMessage('Graduation year must be a year'),
  body('audience.branch')
    .optional({ nullable: true, checkFalsy: true })
    .isString().isLength({ max: 120 }).withMessage('Branch must be 120 characters or fewer'),
  body('audience.organizationId')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 }).withMessage('organizationId must be an id'),
  body('audience.platformWide')
    .optional({ nullable: true })
    .isBoolean({ strict: true }).withMessage('platformWide must be true or false'),
  body('audience.role')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['all', 'student', 'tpo', 'recruiter', 'principal', 'teacher', 'school_admin', 'career_counselor'])
    .withMessage('Unknown role')
];

/**
 * @swagger
 * /api/notifications/announce/preview:
 *   post:
 *     summary: Count the recipients an announcement audience resolves to (TPO, admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/announce/preview',
  authenticateToken,
  requireRole('tpo', 'admin'),
  audienceValidators,
  notificationController.previewAnnouncement
);

/**
 * @swagger
 * /api/notifications/announce:
 *   post:
 *     summary: Send an announcement (TPO → own students; admin → everyone, an org or a role)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string, maxLength: 120 }
 *               message: { type: string, maxLength: 2000 }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               sendEmail: { type: boolean }
 *               audience:
 *                 type: object
 *                 properties:
 *                   graduationYear: { type: integer }
 *                   branch: { type: string }
 *                   organizationId: { type: integer, description: admin only }
 *                   role: { type: string, description: admin only }
 */
router.post('/announce',
  authenticateToken,
  requireRole('tpo', 'admin'),
  announceLimiter,
  [
    body('title').isString().trim().isLength({ min: 3, max: 120 })
      .withMessage('Title must be 3–120 characters'),
    body('message').isString().trim().isLength({ min: 3, max: 2000 })
      .withMessage('Message must be 3–2000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Unknown priority'),
    body('sendEmail').optional().isBoolean().withMessage('sendEmail must be true or false').toBoolean(),
    ...audienceValidators
  ],
  notificationController.announce
);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/unread-count', authenticateToken, notificationController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/read', authenticateToken, notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/mark-all-read', authenticateToken, notificationController.markAllAsRead);

module.exports = router;