const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { body } = require('express-validator');

// TPOs and admins share every route here; the controller scopes what each may
// see and decide (TPO: companies and recruiters; admin: everything).
const REVIEWERS = ['tpo', 'admin'];

const decisionValidators = [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
  body('notes').optional({ nullable: true }).isString().withMessage('Notes must be a string')
    .isLength({ max: 2000 }).withMessage('Notes must be 2000 characters or fewer')
];

/**
 * @swagger
 * /api/approvals/pending:
 *   get:
 *     summary: Get pending approvals for TPO
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending approvals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     organizations:
 *                       type: array
 *                     recruiters:
 *                       type: array
 *                     total:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - TPO access required
 */
router.get('/pending', authenticateToken, requireRole(...REVIEWERS), approvalController.getPendingApprovals);

/**
 * @swagger
 * /api/approvals/organizations/{organizationId}:
 *   patch:
 *     summary: Approve or reject an organization
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to perform
 *               notes:
 *                 type: string
 *                 description: Optional notes for the approval/rejection
 *     responses:
 *       200:
 *         description: Organization approved/rejected successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - TPO access required
 *       404:
 *         description: Organization not found
 */
// The param is constrained to digits so it cannot swallow the literal
// `/organizations/bulk` route declared below it. Express matches in
// declaration order, so without this a bulk request was routed into the
// single-organization handler and died on `parseInt('bulk')`.
router.patch('/organizations/:organizationId(\\d+)', 
  authenticateToken, 
  requireRole(...REVIEWERS),
  decisionValidators,
  approvalController.approveOrganization
);

/**
 * @swagger
 * /api/approvals/recruiters/{userId}:
 *   patch:
 *     summary: Approve or reject a recruiter
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to perform
 *               notes:
 *                 type: string
 *                 description: Optional notes for the approval/rejection
 *     responses:
 *       200:
 *         description: Recruiter approved/rejected successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - TPO access required
 *       404:
 *         description: User not found
 */
router.patch('/recruiters/:userId(\\d+)', 
  authenticateToken, 
  requireRole(...REVIEWERS),
  decisionValidators,
  approvalController.approveRecruiter
);

/**
 * @swagger
 * /api/approvals/organizations/bulk:
 *   patch:
 *     summary: Bulk approve or reject organizations
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationIds
 *               - action
 *             properties:
 *               organizationIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of organization IDs
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to perform
 *               notes:
 *                 type: string
 *                 description: Optional notes for the approval/rejection
 *     responses:
 *       200:
 *         description: Organizations approved/rejected successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - TPO access required
 */
router.patch('/organizations/bulk', 
  authenticateToken, 
  requireRole(...REVIEWERS),
  [
    body('organizationIds').isArray({ min: 1, max: 200 }).withMessage('Organization IDs must be a non-empty array (max 200)'),
    body('organizationIds.*').isInt({ min: 1 }).withMessage('Organization IDs must be integers'),
    ...decisionValidators
  ],
  approvalController.bulkApproveOrganizations
);

/**
 * @swagger
 * /api/approvals/stats:
 *   get:
 *     summary: Get approval statistics for TPO
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Approval statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     organizations:
 *                       type: array
 *                     recruiters:
 *                       type: array
 *                     recentApprovals:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - TPO access required
 */
/**
 * @swagger
 * /api/approvals/organizations:
 *   get:
 *     summary: Paginated organization approval queue (TPO sees companies only)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *       - { in: query, name: type, schema: { type: string, enum: [university, college, school, company] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 */
router.get('/organizations', authenticateToken, requireRole(...REVIEWERS), approvalController.listOrganizations);

/**
 * @swagger
 * /api/approvals/users:
 *   get:
 *     summary: Paginated account approval queue (TPO sees recruiters only)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected, stuck] } }
 *       - { in: query, name: role, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 */
router.get('/users', authenticateToken, requireRole(...REVIEWERS), approvalController.listUsers);

/**
 * @swagger
 * /api/approvals/users/{userId}:
 *   patch:
 *     summary: Approve or reject any pending account (admin), or a recruiter (TPO)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/users/:userId(\\d+)',
  authenticateToken,
  requireRole(...REVIEWERS),
  decisionValidators,
  approvalController.approveUser
);

router.get('/stats', authenticateToken, requireRole(...REVIEWERS), approvalController.getApprovalStats);

module.exports = router;
