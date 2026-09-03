// server/src/routes/offers.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const offerController = require('../controllers/offerController');

const router = express.Router();

/**
 * @swagger
 * /api/offers/stats:
 *   get:
 *     summary: Salary statistics across offers
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
// Before /:id-shaped routes so "stats" is not read as an id.
router.get('/stats',
  authenticateToken,
  requireRole('tpo', 'admin', 'recruiter'),
  offerController.getOfferStats
);

/**
 * @swagger
 * /api/offers:
 *   get:
 *     summary: List offers, scoped to the caller
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, offerController.getOffers);

/**
 * @swagger
 * /api/offers:
 *   post:
 *     summary: Raise an offer against an application
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/',
  authenticateToken,
  requireRole('recruiter', 'tpo', 'admin'),
  [
    body('applicationId').isInt({ min: 1 }),
    // CTC is optional: some offers genuinely arrive before the number does, and
    // refusing to record the offer until then loses the offer as well.
    body('ctc').optional({ nullable: true }).isFloat({ min: 0, max: 1000000000 }),
    body('ctcBreakup').optional().isObject(),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }),
    body('roleTitle').optional().isString().trim().isLength({ max: 255 }),
    body('location').optional().isString().trim().isLength({ max: 255 }),
    body('isPPO').optional().isBoolean(),
    body('joiningDate').optional({ nullable: true }).isISO8601(),
    body('notes').optional().isString().trim().isLength({ max: 2000 })
  ],
  offerController.createOffer
);

/**
 * @swagger
 * /api/offers/{id}/respond:
 *   patch:
 *     summary: Accept or decline an offer
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id(\\d+)/respond',
  authenticateToken,
  requireRole('student'),
  [body('action').isIn(['accept', 'decline'])],
  offerController.respondToOffer
);

/**
 * @swagger
 * /api/offers/{id}/revoke:
 *   patch:
 *     summary: Withdraw an offer already made
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id(\\d+)/revoke',
  authenticateToken,
  requireRole('recruiter', 'tpo', 'admin'),
  [
    // Required, not optional: an offer vanishing with no explanation is the
    // worst thing that can happen to a student here.
    body('reason').isString().trim().isLength({ min: 3, max: 2000 })
      .withMessage('A reason is required when withdrawing an offer')
  ],
  offerController.revokeOffer
);

module.exports = router;
