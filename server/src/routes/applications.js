// server/src/routes/applications.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const applicationController = require('../controllers/applicationController');

const router = express.Router();

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Get applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, applicationController.getApplications);

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Submit job application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', 
  authenticateToken, 
  requireRole('student'),
  [
    body('jobId').isInt(),
    body('coverLetter').optional().isLength({ max: 2000 }),
    body('resumeUrl').optional().isURL()
  ],
  applicationController.submitApplication
);

/**
 * @swagger
 * /api/applications/stats:
 *   get:
 *     summary: Get application statistics
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
// Move stats route BEFORE the :id route to prevent "stats" being interpreted as an ID
router.get('/stats', authenticateToken, applicationController.getApplicationStats);

/**
 * @swagger
 * /api/applications/bulk/update:
 *   patch:
 *     summary: Bulk update applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/bulk/update', 
  authenticateToken, 
  // The controller already scopes TPOs to their own students and handles the
  // role explicitly, but the guard here excluded them, so that branch was
  // unreachable and a placement officer got a 403 on their own institution.
  requireRole('recruiter', 'tpo', 'admin'),
  applicationController.bulkUpdateApplications
);

/**
 * @swagger
 * /api/applications/job/{jobId}/bulk-by-identifier:
 *   post:
 *     summary: Shortlist or reject applicants by pasted roll numbers or emails
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/job/:jobId(\\d+)/bulk-by-identifier',
  authenticateToken,
  requireRole('recruiter', 'tpo', 'admin'),
  [
    body('identifiers').isArray({ min: 1, max: 2000 })
      .withMessage('Provide between 1 and 2000 roll numbers or email addresses'),
    // Blank entries are allowed through deliberately: a pasted column carries
    // empty lines and trailing whitespace, and the controller strips them. A
    // validation error on a blank line would reject the ordinary paste.
    body('identifiers.*').isString().trim().isLength({ max: 190 }),
    body('status').isIn(['screening', 'shortlisted', 'interviewed', 'selected', 'rejected'])
      .withMessage('status must be one of: screening, shortlisted, interviewed, selected, rejected'),
    body('feedback').optional().isString().trim().isLength({ max: 2000 }),
    body('dryRun').optional().isBoolean()
  ],
  applicationController.bulkUpdateByIdentifier
);

/**
 * @swagger
 * /api/applications/job/{jobId}:
 *   get:
 *     summary: Get applications for a job
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/job/:jobId', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  applicationController.getApplicationsByJob
);

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Get application by ID
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
// Move this route AFTER specific routes to prevent conflicts
router.get('/:id', authenticateToken, applicationController.getApplicationById);

/**
 * @swagger
 * /api/applications/{id}/status:
 *   patch:
 *     summary: Update application status
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/status', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  applicationController.updateApplicationStatus
);

/**
 * @swagger
 * /api/applications/{id}/withdraw:
 *   patch:
 *     summary: Withdraw application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/withdraw', 
  authenticateToken, 
  requireRole('student'),
  applicationController.withdrawApplication
);

module.exports = router;