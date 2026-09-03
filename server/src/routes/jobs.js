// server/src/routes/jobs.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const jobController = require('../controllers/jobController');

const router = express.Router();

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs
 *     tags: [Jobs]
 */
router.get('/', optionalAuth, jobController.getAllJobs);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
/**
 * Field rules for a job posting.
 *
 * Shared by create and update. `PUT /api/jobs/:id` previously had NO
 * validation at all — only the create path was checked — so an update could
 * write an unknown jobType, a malformed eligibility object, or a maximum
 * salary below the minimum. `partial` makes every field optional, since an
 * update sends only what changed.
 */
const jobValidators = (partial = false) => {
  const required = (chain) => (partial ? chain.optional() : chain);
  return [

    required(body('title')).notEmpty().trim().isLength({ min: 3, max: 255 }),
    required(body('description')).notEmpty().trim(),
    required(body('jobType')).isIn(['internship', 'full_time', 'part_time']),
    body('location').optional().trim(),
    body('salaryMin').optional().isInt({ min: 0 }),
    body('salaryMax').optional().isInt({ min: 0 }),
    body('experienceRequired').optional().isInt({ min: 0 }),
    body('totalPositions').optional().isInt({ min: 1 }),
    body('applicationDeadline').optional().isISO8601(),
    body('requirements').optional().trim(),
    body('skillsRequired').optional().isArray(),
    body('status').optional().isIn(['draft', 'active', 'closed', 'cancelled']),
    body('eligibilityCriteria').optional().isObject(),
    // Both spellings are accepted for each rule. Seeded and imported jobs store
    // snake_case while the posting form writes camelCase; validating only the
    // camelCase keys meant branch and batch restrictions were accepted
    // completely unchecked.
    body('eligibilityCriteria.minCGPA').optional().isFloat({ min: 0, max: 10 }),
    body('eligibilityCriteria.min_cgpa').optional().isFloat({ min: 0, max: 10 }),
    body('eligibilityCriteria.allowedBranches').optional().isArray(),
    body('eligibilityCriteria.allowed_branches').optional().isArray(),
    body('eligibilityCriteria.allowedBranches.*').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('eligibilityCriteria.allowed_branches.*').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('eligibilityCriteria.graduationYear').optional().isArray(),
    body('eligibilityCriteria.graduation_year').optional().isArray(),
    body('eligibilityCriteria.graduationYear.*').optional().isInt({ min: 1950, max: 2100 }),
    body('eligibilityCriteria.graduation_year.*').optional().isInt({ min: 1950, max: 2100 }),
    body().custom((body) => {
      if (body.salaryMin && body.salaryMax && parseInt(body.salaryMin) > parseInt(body.salaryMax)) {
        throw new Error('Maximum salary must be greater than or equal to minimum salary');
      }
      return true;
    })
  ];
};

router.post('/', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  jobValidators(),
  jobController.createJob
);

/**
 * @swagger
 * /api/jobs/recommended:
 *   get:
 *     summary: Get recommended jobs for student
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
// Move recommended route BEFORE :id route to prevent "recommended" being treated as an ID
router.get('/recommended', 
  authenticateToken, 
  requireRole('student'), 
  jobController.getRecommendedJobs
);

/**
 * @swagger
 * /api/jobs/stats:
 *   get:
 *     summary: Get job statistics
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
// Move stats route BEFORE :id route to prevent "stats" being interpreted as an ID
router.get('/stats', authenticateToken, jobController.getJobStats);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     tags: [Jobs]
 */
// Move this route AFTER specific routes like /recommended and /stats
router.get('/:id', optionalAuth, jobController.getJobById);

/**
 * @swagger
 * /api/jobs/{id}:
 *   put:
 *     summary: Update job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  jobValidators(true),
  jobController.updateJob
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Delete job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  jobController.deleteJob
);

/**
 * @swagger
 * /api/jobs/{id}/status:
 *   patch:
 *     summary: Update job status
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/status', 
  authenticateToken, 
  requireRole('recruiter', 'tpo', 'admin'),
  jobController.toggleJobStatus
);

module.exports = router;