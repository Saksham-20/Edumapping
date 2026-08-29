// server/src/routes/conferences.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const conferenceController = require('../controllers/conferenceController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Conference:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         roomName: { type: string }
 *         title: { type: string }
 *         status: { type: string, enum: [scheduled, live, ended, cancelled] }
 *         access: { type: string, enum: [organization, registered, invite, public] }
 */

/**
 * @swagger
 * /api/conferences:
 *   get:
 *     summary: List conferences visible to the current user
 *     tags: [Conferences]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Conferences retrieved successfully }
 */
router.get('/', authenticateToken, conferenceController.listConferences);

/**
 * @swagger
 * /api/conferences:
 *   post:
 *     summary: Create a live session (host roles only)
 *     tags: [Conferences]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Conference created successfully }
 *       403: { description: Role cannot host sessions }
 */
router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().isLength({ min: 3, max: 255 }),
    body('description').optional({ nullable: true }).isLength({ max: 5000 }),
    body('eventId').optional({ nullable: true }).isInt({ min: 1 }),
    body('scheduledStart').optional({ nullable: true }).isISO8601(),
    body('scheduledEnd').optional({ nullable: true }).isISO8601(),
    body('access').optional().isIn(['organization', 'registered', 'invite', 'public']),
    body('maxParticipants').optional().isInt({ min: 2, max: 200 })
  ],
  conferenceController.createConference
);

/**
 * @swagger
 * /api/conferences/{id}:
 *   get:
 *     summary: Get one conference and whether the caller may join
 *     tags: [Conferences]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', authenticateToken, conferenceController.getConference);

/**
 * @swagger
 * /api/conferences/{id}/token:
 *   post:
 *     summary: Mint a LiveKit access token scoped to the caller's role
 *     description: >
 *       Attendees receive a token permitting microphone only; hosts receive
 *       camera, microphone and screen share plus room admin rights. Publish
 *       permissions are enforced by the LiveKit SFU, not the browser.
 *     tags: [Conferences]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Token issued }
 *       403: { description: Not permitted to join }
 *       503: { description: Conferencing not configured on this server }
 */
router.post('/:id/token', authenticateToken, conferenceController.getJoinToken);

/**
 * @swagger
 * /api/conferences/{id}/participants:
 *   get:
 *     summary: List participants currently connected to the room
 *     tags: [Conferences]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id/participants', authenticateToken, conferenceController.listLiveParticipants);

/* ----------------------------------------------------------- moderation */
// Every handler below re-checks host/cohost rights server-side.

router.post('/:id/participants/:userId/mute', authenticateToken, conferenceController.muteParticipant);
router.post('/:id/participants/:userId/unmute', authenticateToken, conferenceController.unmuteParticipant);
router.post('/:id/mute-all', authenticateToken, conferenceController.muteAll);
router.delete('/:id/participants/:userId', authenticateToken, conferenceController.removeParticipant);
router.post('/:id/participants/:userId/readmit', authenticateToken, conferenceController.readmitParticipant);
router.post('/:id/participants/:userId/lower-hand', authenticateToken, conferenceController.lowerHand);

/* ------------------------------------------------------------ attendee */
router.post('/:id/hand', authenticateToken, conferenceController.setHand);

/* ----------------------------------------------------------- lifecycle */
router.patch('/:id/settings', authenticateToken, conferenceController.updateSettings);
router.post('/:id/end', authenticateToken, conferenceController.endConference);

module.exports = router;
