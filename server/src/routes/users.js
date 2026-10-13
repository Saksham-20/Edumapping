// server/src/routes/users.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requireOwnership } = require('../middleware/rbac');
const userController = require('../controllers/userController');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
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
// Profile rules. Every one says, in plain words, what to change: the bare
// default "Invalid value" left students guessing, and several fields were not
// checked at all — "8,5" saved as CGPA 8, and a DD-MM-YYYY birth date reached
// the DATEONLY column and came back as a 500. Blank optional inputs arrive as
// '' and mean "not set", so they skip validation ('falsy').
const THIS_YEAR = new Date().getFullYear();
const blankOk = { values: 'falsy' };
const decimal = (field, label, min, max, example) =>
  body(field)
    .optional(blankOk)
    .custom((value) => {
      const s = String(value).trim();
      if (/^\d+,\d+$/.test(s)) {
        throw new Error(`Use a full stop, not a comma, in ${label} (for example ${example})`);
      }
      if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`${label} must be a number, like ${example}`);
      const n = Number(s);
      if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`);
      return true;
    });
const wholeNumber = (field, label, min, max) =>
  body(field)
    .optional(blankOk)
    .custom((value) => {
      const s = String(value).trim();
      if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) {
        throw new Error(`${label} must be a whole number from ${min} to ${max}`);
      }
      return true;
    });

const profileRules = [
  body('firstName').optional().trim()
    .isLength({ min: 1, max: 100 }).withMessage('First name cannot be empty (100 characters at most)'),
  body('lastName').optional().trim()
    .isLength({ min: 1, max: 100 }).withMessage('Last name cannot be empty (100 characters at most)'),
  // A blank phone is "no phone"; the form sends '' for an empty input.
  body('phone').optional(blankOk).matches(/^[\+]?[\d\s-]{5,20}$/)
    .withMessage('Enter a phone number like 98765 43210 or +91 98765 43210'),
  decimal('cgpa', 'CGPA', 0, 10, '8.5'),
  decimal('percentage', 'Percentage', 0, 100, '76.4'),
  decimal('class10Percentage', 'Class X percentage', 0, 100, '88.6'),
  decimal('class12Percentage', 'Class XII percentage', 0, 100, '82'),
  decimal('diplomaPercentage', 'Diploma percentage', 0, 100, '74.5'),
  wholeNumber('activeBacklogs', 'Active backlogs', 0, 50),
  wholeNumber('totalBacklogs', 'Total backlogs', 0, 50),
  wholeNumber('educationGapYears', 'Education gap', 0, 20),
  // 1–6 for college years; school students' records carry their class
  // (11, 12) here, and the form posts the stored value back on every save.
  wholeNumber('yearOfStudy', 'Year of study', 1, 12),
  // Wide on purpose: alumni re-save their stored year with every edit, and a
  // narrow window locked anyone who graduated a decade ago out of their profile.
  wholeNumber('graduationYear', 'Graduation year', 1970, THIS_YEAR + 8),
  body('dateOfBirth')
    .optional(blankOk)
    .custom((value) => {
      const s = String(value).trim();
      // A cleared date picker can post "Invalid date"; the controller stores
      // that as "not set", so it is not an error.
      if (s === 'Invalid date') return true;
      const m = /^(\d{4})-(\d{2})-(\d{2})(T[\d:.]+Z?)?$/.exec(s);
      const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (!m || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
        throw new Error('Enter your date of birth using the date picker (day, month and year)');
      }
      const age = THIS_YEAR - +m[1];
      if (age < 10 || age > 80) throw new Error('Check the year of your date of birth');
      return true;
    }),
  body('gender').optional(blankOk).isIn(['male', 'female', 'other'])
    .withMessage('Choose male, female or other'),
  ...['linkedinUrl', 'githubUrl', 'portfolioUrl'].map((field) =>
    body(field).optional(blankOk).isURL()
      .withMessage('Enter a full web address, such as https://linkedin.com/in/your-name')
  ),
  body('studentId').optional(blankOk).trim().isLength({ max: 50 })
    .withMessage('Roll number can be at most 50 characters')
];

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
  profileRules,
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
  uploadLimiter,
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
// Must precede /:id, which used to swallow it ('search' was parsed as an id
// and became a database error). Scoping is in the controller.
router.get('/search',
  authenticateToken,
  requireRole('admin', 'tpo', 'principal', 'school_admin', 'career_counselor', 'teacher', 'recruiter'),
  userController.searchUsers
);

// Visibility (self, admin, same-institution staff, scoped recruiter) is
// enforced in the controller; out-of-scope ids answer 404.
router.get('/:id(\\d+)', authenticateToken, userController.getProfile);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Toggle user status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id(\\d+)/status',
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
  uploadLimiter,
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