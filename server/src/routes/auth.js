// server/src/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } = authService;
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, authIpLimiter, registerLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation middleware
// Every rule names its field in plain words: the form shows the first message
// verbatim. Email is trimmed and lower-cased but otherwise kept as typed;
// `normalizeEmail()` used to strip the dots out of Gmail addresses, so
// "sanjay.dixit@gmail.com" was saved as "sanjaydixit@gmail.com" and that
// person could not sign in with the address they registered with.
const validateRegistration = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password needs an uppercase letter, a lowercase letter and a number'),
  body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name is required'),
  body('role')
    .isIn(['student', 'recruiter', 'tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'])
    .withMessage('Choose who you are registering as'),
  body('otp')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('The verification code is the 6 digits from the email'),
  body('organizationId')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // Allow null, undefined, or empty string
      }
      return Number.isInteger(Number(value)); // Must be a valid integer if provided
    })
    .withMessage('Choose your college, school or company from the list')
];

// Login: identifier = email OR phone (backward compat: email still accepted)
const validateLogin = [
  body('identifier').optional().trim(),
  body('email').optional().trim(),
  body('password').notEmpty().withMessage('Enter your password'),
  (req, res, next) => {
    const id = req.body.identifier || req.body.email;
    if (!id || !String(id).trim()) {
      const message = 'Enter your email address or phone number';
      return res.status(400).json({ error: 'Validation Error', message, details: [{ field: 'identifier', message }] });
    }
    req.body._loginId = String(id).trim();
    next();
  }
];

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, recruiter, tpo]
 *               organizationId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
// Tells the signup screens whether to ask for an emailed code. Public and
// constant per deployment; it reveals only whether SMTP is configured.
// `emailEnabled` lets the forgot-password screen say up front that no code
// can be emailed, instead of promising one that never arrives.
router.get('/config', (req, res) => {
  const emailEnabled = authService.emailVerificationRequired();
  res.json({ emailVerificationRequired: emailEnabled, emailEnabled });
});

router.post('/register/send-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const email = req.body.email && String(req.body.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Validation Error', message: 'Enter a valid email address', details: [{ field: 'email', message: 'Enter a valid email address' }] });
    }
    const result = await authService.sendRegistrationOtp(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/register', registerLimiter, otpVerifyLimiter, validateRegistration, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
      return res.status(400).json({
        error: 'Validation Error',
        message: details[0].message,
        details
      });
    }

    const result = await authService.register(req.body);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authIpLimiter, authLimiter, validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
      return res.status(400).json({ error: 'Validation Error', message: details[0].message, details });
    }

    const identifier = req.body._loginId;
    const { password } = req.body;
    const result = await authService.login(identifier, password);
    
    res.json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh Token Required',
        message: 'Refresh token is required'
      });
    }

    const tokens = await authService.refreshTokens(refreshToken);
    
    res.json({
      message: 'Tokens refreshed successfully',
      tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password/send-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const email = req.body.email && String(req.body.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Validation Error', message: 'Enter a valid email address', details: [{ field: 'email', message: 'Enter a valid email address' }] });
    }
    const result = await authService.sendForgotPasswordOtp(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Was unlimited: the only thing between a guesser and any account's password
// was a six-digit code. Now rate limited per IP and per address, on top of the
// per-code attempt counter in the service.
router.post('/forgot-password/reset-with-otp', otpVerifyLimiter, async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const missing = [
      !email && { field: 'email', message: 'Enter your email address' },
      !otp && { field: 'otp', message: 'Enter the 6-digit code from the email' },
      !newPassword && { field: 'newPassword', message: 'Enter a new password' }
    ].filter(Boolean);
    if (missing.length) {
      return res.status(400).json({ error: 'Validation Error', message: missing[0].message, details: missing });
    }
    // Same policy as registration and change-password.
    if (String(newPassword).length < 8 || !PASSWORD_POLICY.test(String(newPassword))) {
      return res.status(400).json({
        error: 'Validation Error',
        message: PASSWORD_POLICY_MESSAGE,
        details: [{ field: 'newPassword', message: PASSWORD_POLICY_MESSAGE }]
      });
    }
    const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change the signed-in user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password is incorrect
 */
router.post(
  '/change-password',
  authenticateToken,
  // Same strength rules as registration, so a password change cannot be used
  // to sidestep the policy the account was created under.
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password needs an uppercase letter, a lowercase letter and a number'),
  body('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from the current one'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
        return res.status(400).json({ error: 'Validation Error', message: details[0].message, details });
      }
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;