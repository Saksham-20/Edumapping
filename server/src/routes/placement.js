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
const { createUploadMiddleware, FILE_TYPES, handleMulterError } = require('../config/multer');
const placementController = require('../controllers/placementController');

const router = express.Router();

// The shared multer handler answers with MIME-type lists
// ("Allowed types: application/vnd.ms-excel, …"), which a placement officer
// cannot act on. Say what to upload instead.
const importUploadError = (err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File Too Large', message: 'This file is over 5 MB. Split the batch into smaller sheets and import each.' });
  }
  if (/Invalid file (type|extension)/.test(err?.message || '')) {
    return res.status(400).json({ error: 'Invalid File Type', message: 'Upload an Excel (.xlsx or .xls) or CSV file.' });
  }
  return handleMulterError(err, req, res, next);
};
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
    body('enabled').isBoolean().withMessage('Say whether the policy is on or off.'),
    body('tiers').optional().isArray({ max: 6 }).withMessage('Use at most 6 tiers.'),
    body('maxOffers').optional({ nullable: true }).isInt({ min: 1, max: 10 }).withMessage('The offer cap must be between 1 and 10.'),
    body('placedRule').optional().isIn(['none', 'higher_tier', 'ctc_multiplier']).withMessage('Choose what a placed student may apply to.'),
    body('ctcMultiplier')
      .optional({ nullable: true })
      .isFloat({ min: 1, max: 10 })
      .withMessage('The CTC multiple must be between 1 and 10 (for example 1.5).')
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

/**
 * @swagger
 * /api/placement/students/import:
 *   post:
 *     summary: Import a batch of students from an Excel / CSV sheet into the caller's institution
 *     tags: [Placement]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/students/import',
  ...cell,
  uploadLimiter,
  createUploadMiddleware('file', {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: [...FILE_TYPES.SPREADSHEETS.mimeTypes, 'application/octet-stream'],
    allowedExtensions: FILE_TYPES.SPREADSHEETS.extensions
  }),
  importUploadError,
  placementController.importStudents
);
router.post('/students/verify-bulk', ...cell, body('userIds').isArray({ min: 1, max: 500 }).withMessage('Select between 1 and 500 students.'), handleValidationErrors, placementController.bulkVerify);
router.post(
  '/students/:userId(\\d+)/verification',
  ...cell,
  param('userId').isInt(),
  body('action').isIn(['verify', 'reject', 'unlock']).withMessage('Choose verify, send back or unlock.'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Keep the note under 1,000 characters.'),
  handleValidationErrors,
  placementController.reviewVerification
);
router.patch(
  '/students/:userId(\\d+)/outcome',
  ...cell,
  body('placementStatus')
    .isIn(['higher_studies', 'opted_out', 'deferred', 'auto'])
    .withMessage('Choose higher studies, opted out, deferred, or "from offers". A student is marked placed by recording their offer.'),
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
