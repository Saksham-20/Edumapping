// server/src/routes/rounds.js
//
// Selection rounds of a drive and who is in each.
const express = require('express');
const { body, param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { handleValidationErrors } = require('../middleware/validation');
const roundController = require('../controllers/roundController');

const router = express.Router();
const staff = [authenticateToken, requireRole('recruiter', 'tpo', 'admin')];

const roundRules = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('roundType').optional().isIn(['aptitude', 'coding', 'group_discussion', 'technical', 'hr', 'other']),
  body('scheduledAt').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('endsAt').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('mode').optional().isIn(['on_campus', 'online']),
  body('venue').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('meetingLink').optional({ nullable: true, checkFalsy: true }).isURL({ require_protocol: true }),
  body('instructions').optional({ nullable: true }).isString().isLength({ max: 4000 }),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
];

/**
 * @swagger
 * /api/rounds/mine:
 *   get:
 *     summary: The signed-in student's selection rounds
 *     tags: [Rounds]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/mine', authenticateToken, requireRole('student'), roundController.mine);

/**
 * @swagger
 * /api/rounds:
 *   get:
 *     summary: Rounds of a job (?jobId=) with participants
 *     tags: [Rounds]
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     summary: Schedule a round
 *     tags: [Rounds]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...staff, roundController.listForJob);
router.post('/', ...staff, [body('jobId').isInt(), body('name').isString().trim().isLength({ min: 1, max: 120 }), ...roundRules], roundController.create);
router.put('/:id(\\d+)', ...staff, [param('id').isInt(), ...roundRules], roundController.update);
router.delete('/:id(\\d+)', ...staff, roundController.remove);

router.post(
  '/:id(\\d+)/participants',
  ...staff,
  [
    body('applicationIds').optional().isArray({ max: 1000 }),
    body('identifiers').optional().isArray({ max: 1000 }),
    body('slotAt').optional({ nullable: true, checkFalsy: true }).isISO8601()
  ],
  handleValidationErrors,
  roundController.addParticipants
);
router.post('/:id(\\d+)/results', ...staff, roundController.recordResults);
router.patch('/:id(\\d+)/participants/:participantId(\\d+)', ...staff, roundController.updateParticipant);
router.delete('/:id(\\d+)/participants/:participantId(\\d+)', ...staff, roundController.removeParticipant);

module.exports = router;
