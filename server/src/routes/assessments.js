// server/src/routes/assessments.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const assessmentController = require('../controllers/assessmentController');

const router = express.Router();

/**
 * @swagger
 * /api/assessments:
 *   get:
 *     summary: Get assessments
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, assessmentController.getAssessments);

/**
 * @swagger
 * /api/assessments:
 *   post:
 *     summary: Create assessment
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  [
    body('title').notEmpty().isLength({ min: 3, max: 255 }),
    body('assessmentType').isIn(['technical', 'aptitude', 'personality', 'coding', 'other']),
    body('duration').isInt({ min: 1 }),
    body('questions').isArray()
  ],
  assessmentController.createAssessment
);

/**
 * @swagger
 * /api/assessments/{id}/take:
 *   post:
 *     summary: Start taking assessment
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/assessments/{id}/results:
 *   get:
 *     summary: Results for an assessment, for the person who created it
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id/results',
  authenticateToken,
  requireRole('recruiter', 'tpo', 'admin'),
  assessmentController.getAssessmentResults
);

router.post('/:id/take', 
  authenticateToken, 
  requireRole('student'),
  assessmentController.takeAssessment
);

/**
 * @swagger
 * /api/assessments/{id}/submit:
 *   post:
 *     summary: Submit assessment
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/submit', 
  authenticateToken, 
  requireRole('student'),
  [
    body('answers').isArray(),
    body('timeSpent').isInt({ min: 0 })
  ],
  assessmentController.submitAssessment
);

module.exports = router;