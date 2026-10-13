// server/src/routes/assistant.js
//
// "Ask EduMapping" placement assistant. 503 when ANTHROPIC_API_KEY is unset.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const assistantService = require('../services/assistantService');
const logger = require('../utils/logger');

const router = express.Router();

// Each question can be several model calls; keep a student from running up the
// bill by holding the key down.
const assistantLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `assistant:${req.user?.id || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'You have asked a lot of questions in a short time. Try again in a few minutes.' }
});

/**
 * @swagger
 * /api/assistant/status:
 *   get:
 *     summary: Whether the placement assistant is available
 *     tags: [Assistant]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/status', authenticateToken, (req, res) => {
  res.json({ enabled: assistantService.isConfigured() });
});

/**
 * @swagger
 * /api/assistant/chat:
 *   post:
 *     summary: Ask the placement assistant a question
 *     tags: [Assistant]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/chat',
  authenticateToken,
  assistantLimiter,
  [body('messages').isArray({ min: 1, max: 30 }), body('messages.*.role').isIn(['user', 'assistant']), body('messages.*.content').isString().isLength({ max: 4000 })],
  handleValidationErrors,
  async (req, res, next) => {
    if (!assistantService.isConfigured()) {
      return res.status(503).json({ error: 'Assistant Unavailable', message: 'The assistant is not set up on this server yet.' });
    }
    try {
      const result = await assistantService.chat(req.user, req.body.messages);
      res.json(result);
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: 'Validation Error', message: error.message });
      logger.error('Assistant chat failed', error);
      res.status(502).json({ error: 'Assistant Error', message: 'The assistant could not answer right now. Please try again.' });
    }
  }
);

module.exports = router;
