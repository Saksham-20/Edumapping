// server/src/routes/audit.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const auditController = require('../controllers/auditController');

const router = express.Router();

/**
 * @swagger
 * /api/audit/my-data:
 *   get:
 *     summary: Which organisations have seen this student's profile
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 */
// Before the collection route, and open to students only — this is their own
// record, not the institution's activity feed.
router.get('/my-data',
  authenticateToken,
  requireRole('student'),
  auditController.getMyDataAccess
);

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Institution activity log
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 */
router.get('/',
  authenticateToken,
  requireRole('tpo', 'admin'),
  auditController.getAuditLog
);

module.exports = router;
