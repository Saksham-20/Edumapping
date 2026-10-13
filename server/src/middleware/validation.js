// server/src/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Common validation rules
const commonValidations = {
  email: body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
  password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: (field) => body(field).trim().isLength({ min: 1, max: 100 }),
  // Fixed phone validation to allow empty strings
  phone: body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^[\+]?[1-9][\d]{0,15}$/),
  url: (field) => body(field).optional().isURL(),
  date: (field) => body(field).optional().isISO8601(),
  id: (field) => param(field).isInt({ min: 1 }),
  positiveInt: (field) => body(field).optional().isInt({ min: 0 }),
  decimal: (field) => body(field).optional().isDecimal({ decimal_digits: '0,2' })
};

// Alternative approach - custom phone validation
const validatePhone = body('phone').custom((value) => {
  // Allow empty, null, or undefined
  if (!value || value === '') {
    return true;
  }
  // If value exists, validate format
  if (!/^[\+]?[1-9][\d]{0,15}$/.test(value)) {
    throw new Error('Invalid phone number format');
  }
  return true;
});

// User validation
const validateUserRegistration = [
  commonValidations.email,
  commonValidations.password,
  commonValidations.name('firstName'),
  commonValidations.name('lastName'),
  body('role').isIn(['student', 'recruiter', 'tpo']),
  body('organizationId').optional().isInt({ min: 1 }),
  validatePhone  // Use the custom phone validation
];  

const validateUserLogin = [
  commonValidations.email,
  body('password').notEmpty()
];

const validateUserUpdate = [
  commonValidations.name('firstName').optional(),
  commonValidations.name('lastName').optional(),
  commonValidations.phone
];

// Job validation
const validateJobCreation = [
  body('title').trim().isLength({ min: 3, max: 255 }),
  body('description').trim().isLength({ min: 10 }),
  body('jobType').isIn(['internship', 'full_time', 'part_time']),
  body('location').optional().trim().isLength({ max: 255 }),
  commonValidations.positiveInt('salaryMin'),
  commonValidations.positiveInt('salaryMax'),
  commonValidations.positiveInt('experienceRequired'),
  body('skillsRequired').optional().isArray(),
  commonValidations.positiveInt('totalPositions'),
  commonValidations.date('applicationDeadline'),
  body('status').optional().isIn(['draft', 'active', 'closed', 'cancelled']),
  body('eligibilityCriteria').optional().isObject()
];

// Application validation
const validateApplicationSubmission = [
  body('jobId').isInt({ min: 1 }),
  body('coverLetter').optional().trim().isLength({ max: 2000 }),
  commonValidations.url('resumeUrl')
];

const validateApplicationStatusUpdate = [
  body('status').isIn(['applied', 'screening', 'shortlisted', 'interviewed', 'selected', 'rejected', 'withdrawn']),
  body('feedback').optional().trim().isLength({ max: 1000 })
];

// Event validation
const validateEventCreation = [
  body('title').trim().isLength({ min: 3, max: 255 }),
  body('description').trim().isLength({ min: 10 }),
  body('eventType').isIn(['campus_drive', 'info_session', 'workshop', 'seminar', 'job_fair', 'other']),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('location').optional().trim().isLength({ max: 255 }),
  commonValidations.url('virtualLink'),
  commonValidations.positiveInt('maxParticipants'),
  commonValidations.date('registrationDeadline'),
  body('status').optional().isIn(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'])
];

// Assessment validation
const validateAssessmentCreation = [
  body('title').trim().isLength({ min: 3, max: 255 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('assessmentType').isIn(['technical', 'aptitude', 'personality', 'coding', 'other']),
  body('duration').isInt({ min: 1, max: 480 }), // Max 8 hours
  commonValidations.positiveInt('totalMarks'),
  commonValidations.positiveInt('passingMarks'),
  body('questions').isArray(),
  body('instructions').optional().trim().isLength({ max: 2000 })
];

// Student profile validation
const validateStudentProfile = [
  body('studentId').optional().trim().isLength({ max: 50 }),
  commonValidations.date('dateOfBirth'),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('course').optional().trim().isLength({ max: 100 }),
  body('branch').optional().trim().isLength({ max: 100 }),
  body('yearOfStudy').optional().isInt({ min: 1, max: 6 }),
  body('graduationYear').optional().isInt({ min: 2020, max: 2030 }),
  body('cgpa').optional().isDecimal({ decimal_digits: '0,2' }).custom(value => {
    if (value < 0 || value > 10) {
      throw new Error('CGPA must be between 0 and 10');
    }
    return true;
  }),
  body('percentage').optional().isDecimal({ decimal_digits: '0,2' }).custom(value => {
    if (value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return true;
  }),
  body('address').optional().trim().isLength({ max: 500 }),
  body('skills').optional().isArray(),
  body('bio').optional().trim().isLength({ max: 1000 }),
  commonValidations.url('linkedinUrl'),
  commonValidations.url('githubUrl'),
  commonValidations.url('portfolioUrl'),
  body('placementStatus').optional().isIn(['placed', 'unplaced', 'deferred'])
];

// Query parameter validation
const validatePagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateJobFilters = [
  ...validatePagination,
  query('status').optional().isIn(['draft', 'active', 'closed', 'cancelled']),
  query('jobType').optional().isIn(['internship', 'full_time', 'part_time']),
  query('location').optional().trim(),
  query('organizationId').optional().isInt({ min: 1 }),
  query('search').optional().trim().isLength({ min: 2, max: 100 }),
  query('salaryMin').optional().isInt({ min: 0 }),
  query('salaryMax').optional().isInt({ min: 0 }),
  query('experienceRequired').optional().isInt({ min: 0 })
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // No `value` in the response: it echoed submitted passwords back.
    const details = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg === 'Invalid value' ? `${error.path || error.param} is not valid` : error.msg
    }));
    return res.status(400).json({
      error: 'Validation Error',
      message: details[0].message,
      details
    });
  }
  next();
};

module.exports = {
  commonValidations,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validateJobCreation,
  validateApplicationSubmission,
  validateApplicationStatusUpdate,
  validateEventCreation,
  validateAssessmentCreation,
  validateStudentProfile,
  validatePagination,
  validateJobFilters,
  handleValidationErrors
};

