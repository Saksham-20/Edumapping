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
// The largest pay figure accepted, in rupees: 100 crore a year. The column is
// a 32-bit integer, so anything past ~214 crore used to reach Postgres and come
// back as a 500 with the SQL in the body; a figure this large is a typo anyway
// (usually an extra zero, or LPA typed into a rupee field).
const MAX_SALARY = 1000000000;

const jobValidators = (partial = false) => {
  const required = (chain) => (partial ? chain.optional() : chain);
  // Every rule carries its own sentence. express-validator's default is the
  // bare "Invalid value", which told a recruiter something was wrong with the
  // form but not what or where.
  const pct = (key, label) =>
    body(`eligibilityCriteria.${key}`).optional({ nullable: true })
      .isFloat({ min: 0, max: 100 }).withMessage(`${label} must be a percentage between 0 and 100`);
  return [
    required(body('title'))
      .trim()
      .notEmpty().withMessage('Enter a job title, e.g. Graduate Engineer Trainee')
      .bail()
      .isLength({ min: 3, max: 255 }).withMessage('Job title must be between 3 and 255 characters'),
    required(body('description'))
      .trim()
      .notEmpty().withMessage('Describe the role so students know what they are applying for'),
    required(body('jobType'))
      .isIn(['internship', 'full_time', 'part_time']).withMessage('Choose full time, part time or internship'),
    body('location').optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage('Location must be under 255 characters'),
    body('salaryMin').optional({ nullable: true })
      .isInt({ min: 0, max: MAX_SALARY }).withMessage('Minimum pay must be a whole number of rupees, e.g. 600000 for 6 LPA'),
    body('salaryMax').optional({ nullable: true })
      .isInt({ min: 0, max: MAX_SALARY }).withMessage('Maximum pay must be a whole number of rupees, e.g. 1200000 for 12 LPA'),
    body('experienceRequired').optional({ nullable: true })
      .isInt({ min: 0, max: 50 }).withMessage('Experience must be a whole number of years between 0 and 50'),
    body('totalPositions').optional({ nullable: true })
      .isInt({ min: 1, max: 100000 }).withMessage('Number of openings must be at least 1'),
    body('applicationDeadline').optional({ nullable: true })
      .isISO8601().withMessage('Application deadline must be a date, e.g. 2026-11-30'),
    body('requirements').optional({ nullable: true }).trim(),
    body('skillsRequired').optional().isArray().withMessage('Skills must be a list'),
    body('status').optional().isIn(['draft', 'active', 'closed', 'cancelled'])
      .withMessage('Status must be draft, active, closed or cancelled'),
    body('eligibilityCriteria').optional().isObject().withMessage('Eligibility criteria must be an object'),
    // Both spellings are accepted for each rule. Seeded and imported jobs store
    // snake_case while the posting form writes camelCase; validating only the
    // camelCase keys meant branch and batch restrictions were accepted
    // completely unchecked.
    body('eligibilityCriteria.minCGPA').optional({ nullable: true }).isFloat({ min: 0, max: 10 }).withMessage('Minimum CGPA must be between 0 and 10'),
    body('eligibilityCriteria.min_cgpa').optional({ nullable: true }).isFloat({ min: 0, max: 10 }).withMessage('Minimum CGPA must be between 0 and 10'),
    body('eligibilityCriteria.allowedBranches').optional().isArray().withMessage('Eligible branches must be a list'),
    body('eligibilityCriteria.allowed_branches').optional().isArray().withMessage('Eligible branches must be a list'),
    body('eligibilityCriteria.allowedBranches.*').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('Each branch name must be under 120 characters'),
    body('eligibilityCriteria.allowed_branches.*').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('Each branch name must be under 120 characters'),
    body('eligibilityCriteria.graduationYear').optional().isArray().withMessage('Graduating batches must be a list of years'),
    body('eligibilityCriteria.graduation_year').optional().isArray().withMessage('Graduating batches must be a list of years'),
    body('eligibilityCriteria.graduationYear.*').optional().isInt({ min: 1950, max: 2100 }).withMessage('Each graduating batch must be a four-digit year'),
    body('eligibilityCriteria.graduation_year.*').optional().isInt({ min: 1950, max: 2100 }).withMessage('Each graduating batch must be a four-digit year'),
    // The academic bars real postings state. Both spellings again, since
    // seeded and imported rows use snake_case.
    body('eligibilityCriteria.maxBacklogs').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('Maximum backlogs must be a whole number, 0 for none allowed'),
    body('eligibilityCriteria.max_backlogs').optional({ nullable: true }).isInt({ min: 0, max: 100 }).withMessage('Maximum backlogs must be a whole number, 0 for none allowed'),
    pct('minClass10Percentage', 'Minimum Class X %'),
    pct('min_class10_percentage', 'Minimum Class X %'),
    pct('minClass12Percentage', 'Minimum Class XII %'),
    pct('min_class12_percentage', 'Minimum Class XII %'),
    body('eligibilityCriteria.maxEducationGapYears').optional({ nullable: true }).isInt({ min: 0, max: 20 }).withMessage('Maximum education gap must be a whole number of years'),
    body('eligibilityCriteria.max_education_gap_years').optional({ nullable: true }).isInt({ min: 0, max: 20 }).withMessage('Maximum education gap must be a whole number of years'),
    // Reported against salaryMax so the form can put it under that input; the
    // whole-body custom() it replaces surfaced with an empty field name. On an
    // update only the submitted pair is compared here; the controller checks a
    // lone figure against the stored one.
    body('salaryMax').custom((max, { req }) => {
      const min = req.body.salaryMin;
      if (min !== undefined && min !== null && min !== '' && max !== null && max !== '' &&
          Number(min) > Number(max)) {
        throw new Error('Maximum pay must be greater than or equal to minimum pay');
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
 * /api/jobs/pending-review:
 *   get:
 *     summary: Job postings awaiting the placement cell's approval
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
// Before /:id, like the other named routes above, or "pending-review" is read
// as a job id.
router.get('/pending-review',
  authenticateToken,
  requireRole('tpo', 'admin'),
  jobController.getPendingJobs
);

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

/**
 * @swagger
 * /api/jobs/{id}/review:
 *   patch:
 *     summary: Approve or reject a pending job posting
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id(\\d+)/review',
  authenticateToken,
  requireRole('tpo', 'admin'),
  [
    body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
    body('notes').optional().isString().trim().isLength({ max: 2000 })
  ],
  jobController.reviewJob
);

module.exports = router;