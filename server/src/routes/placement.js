// server/src/routes/placement.js
//
// The placement cell's tools: policy, roster and verification, the annual
// report, and the drive calendar (which every signed-in role reads).
const express = require('express');
const { param, body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { handleValidationErrors } = require('../middleware/validation');
const placementController = require('../controllers/placementController');

const router = express.Router();
const cell = [authenticateToken, requireRole('tpo', 'admin')];

/**
 * @swagger
 * /api/placement/policy:
 *   get:
 *     summary: The institution's placement policy (offer caps, dream tiers)
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     summary: Save the placement policy
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/policy', authenticateToken, requireRole('tpo', 'admin', 'student'), placementController.getPolicy);
router.put(
  '/policy',
  ...cell,
  [
    body('enabled').isBoolean(),
    body('tiers').optional().isArray({ max: 6 }),
    body('maxOffers').optional({ nullable: true }).isInt({ min: 1, max: 10 }),
    body('placedRule').optional().isIn(['none', 'higher_tier', 'ctc_multiplier']),
    body('ctcMultiplier').optional({ nullable: true }).isFloat({ min: 1, max: 10 })
  ],
  handleValidationErrors,
  placementController.updatePolicy
);

/**
 * @swagger
 * /api/placement/students:
 *   get:
 *     summary: The institution's student roster with verification and outcomes
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/students', ...cell, placementController.listStudents);
router.get('/students/export', ...cell, placementController.exportStudents);
router.post('/students/verify-bulk', ...cell, body('userIds').isArray({ min: 1, max: 500 }), handleValidationErrors, placementController.bulkVerify);
router.post(
  '/students/:userId(\\d+)/verification',
  ...cell,
  param('userId').isInt(),
  body('action').isIn(['verify', 'reject', 'unlock']),
  body('notes').optional().isString().isLength({ max: 1000 }),
  handleValidationErrors,
  placementController.reviewVerification
);
router.patch(
  '/students/:userId(\\d+)/outcome',
  ...cell,
  body('placementStatus').isIn(['higher_studies', 'opted_out', 'deferred', 'auto']),
  handleValidationErrors,
  placementController.setOutcome
);

router.post('/verification/request', authenticateToken, requireRole('student'), placementController.requestVerification);
router.post(
  '/verification/marksheet',
  authenticateToken,
  requireRole('student'),
  uploadLimiter,
  uploadSingle('document', ['application/pdf']),
  placementController.uploadMarksheet
);

/**
 * @swagger
 * /api/placement/report:
 *   get:
 *     summary: NIRF / NAAC style placement report for a batch (JSON or ?format=xlsx)
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/report', ...cell, placementController.report);

/**
 * @swagger
 * /api/placement/calendar:
 *   get:
 *     summary: Events, selection rounds and deadlines for the caller (?format=ics for a calendar file)
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/calendar', authenticateToken, placementController.calendar);

module.exports = router;
