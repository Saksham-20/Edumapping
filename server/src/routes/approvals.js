const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { body } = require('express-validator');

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
router.get('/pending', authenticateToken, requireRole('tpo'), approvalController.getPendingApprovals);

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
  requireRole('tpo'),
  [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
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
router.patch('/recruiters/:userId', 
  authenticateToken, 
  requireRole('tpo'),
  [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
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
  requireRole('tpo'),
  [
    body('organizationIds').isArray().withMessage('Organization IDs must be an array'),
    body('organizationIds.*').isInt().withMessage('Organization IDs must be integers'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
    body('notes').optional().isString().withMessage('Notes must be a string')
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
router.get('/stats', authenticateToken, requireRole('tpo'), approvalController.getApprovalStats);

module.exports = router;
