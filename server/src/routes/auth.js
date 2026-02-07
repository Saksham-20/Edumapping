// server/src/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, otpSendLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().isLength({ min: 1, max: 100 }),
  body('lastName').trim().isLength({ min: 1, max: 100 }),
  body('role').isIn(['student', 'recruiter', 'tpo', 'principal', 'teacher', 'school_admin', 'career_counselor']),
  body('otp').optional().isLength({ min: 6, max: 6 }).isNumeric(),
  body('organizationId')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // Allow null, undefined, or empty string
      }
      return Number.isInteger(Number(value)); // Must be a valid integer if provided
    })
    .withMessage('Organization ID must be a valid integer')
];

// Login: identifier = email OR phone (backward compat: email still accepted)
const validateLogin = [
  body('identifier').optional().trim(),
  body('email').optional().trim(),
  body('password').notEmpty(),
  (req, res, next) => {
    const id = req.body.identifier || req.body.email;
    if (!id || !String(id).trim()) {
      return res.status(400).json({ error: 'Validation Error', details: [{ msg: 'identifier or email is required' }] });
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
router.post('/register/send-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const email = req.body.email && String(req.body.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Validation Error', details: [{ msg: 'Valid email is required' }] });
    }
    const result = await authService.sendRegistrationOtp(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, validateRegistration, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
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
router.post('/login', authLimiter, validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
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
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    user: req.user
  });
});

router.post('/forgot-password/send-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const email = req.body.email && String(req.body.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Validation Error', details: [{ msg: 'Valid email is required' }] });
    }
    const result = await authService.sendForgotPasswordOtp(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password/reset-with-otp', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        error: 'Validation Error',
        details: [{ msg: 'email, otp and newPassword are required' }]
      });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        details: [{ msg: 'Password must be at least 8 characters' }]
      });
    }
    const result = await authService.resetPasswordWithOtp(email, otp, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;