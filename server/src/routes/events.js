// server/src/routes/events.js
const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireRole, requireNotRole, requireOrganization } = require('../middleware/rbac');
const eventController = require('../controllers/eventController');

/**
 * Students cannot run events. The generic role guard answered with "not
 * allowed for the following roles: student", which reads like a system error;
 * this says what to do instead. Placed before `requireOrganization` so a
 * student without an institution still gets this message, not that one.
 */
const organizersOnly = (req, res, next) => {
  if (req.user?.role === 'student') {
    return res.status(403).json({
      error: 'Access Forbidden',
      message: 'Students cannot create or change events. Ask your placement office or teacher to add it.'
    });
  }
  return next();
};

const router = express.Router();

/**
 * Field rules shared by create and update.
 *
 * Every rule carries a sentence: the bare default ("Invalid value") left an
 * organizer guessing which field to fix. Optional fields use `checkFalsy`
 * because the form sends an empty string for a cleared input, and
 * `.optional()` alone only skips `undefined` — clearing the meeting link used
 * to fail `isURL` on "".
 */
const EVENT_TYPES = ['campus_drive', 'info_session', 'workshop', 'seminar', 'job_fair', 'other'];
const EVENT_STATUSES = ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'];

const eventFieldRules = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Give the event a title between 3 and 255 characters'),
  body('description').trim().notEmpty().withMessage('Describe the event so students know what to expect'),
  body('eventType').isIn(EVENT_TYPES).withMessage('Choose an event type'),
  body('startTime').isISO8601().withMessage('Enter a valid start date and time'),
  body('endTime').isISO8601().withMessage('Enter a valid end date and time'),
  body('location')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Keep the location under 255 characters'),
  body('maxParticipants')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 100000 })
    .withMessage('Max participants must be a whole number of 1 or more')
    .toInt(),
  // A link typed without "https://" (meet.google.com/abc-defg-hij) is what
  // people paste from a phone. Store it with the scheme so "Join" can open it
  // instead of reporting an invalid link.
  body('virtualLink')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((v) => (typeof v === 'string' && v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? `https://${v}` : v))
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Enter a full meeting link, for example https://meet.google.com/abc-defg-hij')
    .isLength({ max: 500 })
    .withMessage('The meeting link is too long'),
  body('registrationDeadline')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Enter a valid registration closing date'),
  body('status').optional().isIn(EVENT_STATUSES).withMessage('Choose a valid status'),
  body().custom((value) => {
    const start = value.startTime ? new Date(value.startTime) : null;
    const end = value.endTime ? new Date(value.endTime) : null;
    if (start && end && start >= end) {
      throw new Error('The event must end after it starts');
    }
    if (value.registrationDeadline && end && new Date(value.registrationDeadline) > end) {
      throw new Error('Registration must close before the event ends');
    }
    return true;
  })
];

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 */
router.get('/', optionalAuth, eventController.getAllEvents);

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', 
  authenticateToken, 
  organizersOnly,
  (req, res, next) => {
    // Admins may not be attached to an organization; allow them to specify organizationId in body.
    if (req.user?.role === 'admin') return next();
    return requireOrganization(req, res, next);
  },
  requireNotRole('student'),
  [
    body('organizationId').custom((value, { req }) => {
      // For admins without an organization, organizationId is required.
      if (req.user?.role === 'admin' && !req.user.organizationId) {
        if (value === undefined || value === null || value === '') {
          throw new Error('Choose which organization is running this event');
        }
      }

      // If provided, it must be an integer.
      if (value !== undefined && value !== null && value !== '') {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) {
          throw new Error('Choose a valid organization');
        }
      }
      return true;
    }),
    ...eventFieldRules
  ],
  eventController.createEvent
);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 */
router.get('/:id', optionalAuth, eventController.getEventById);

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', 
  authenticateToken, 
  organizersOnly,
  (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return requireOrganization(req, res, next);
  },
  requireNotRole('student'),
  [
    ...eventFieldRules
  ],
  eventController.updateEvent
);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete an event that nobody is registered for
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id',
  authenticateToken,
  organizersOnly,
  eventController.deleteEvent
);

/**
 * @swagger
 * /api/events/{id}/register:
 *   post:
 *     summary: Register for event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/register', 
  authenticateToken, 
  eventController.registerForEvent
);

/**
 * @swagger
 * /api/events/{id}/cancel:
 *   post:
 *     summary: Cancel event registration
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/events/{id}/registrations:
 *   get:
 *     summary: List who registered for an event (organisers only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id/registrations',
  authenticateToken,
  requireNotRole('student'),
  eventController.listEventRegistrations
);

/**
 * @swagger
 * /api/events/{id}/attendance:
 *   patch:
 *     summary: Mark attendance for one or more registrations (organisers only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id/attendance',
  authenticateToken,
  requireNotRole('student'),
  [
    body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array'),
    body('userIds.*').isInt({ min: 1 }).withMessage('Each user id must be a positive integer'),
    body('status')
      .isIn(['registered', 'attended', 'no_show'])
      .withMessage('status must be one of: registered, attended, no_show')
  ],
  eventController.markEventAttendance
);

router.post('/:id/cancel', 
  authenticateToken, 
  eventController.cancelEventRegistration
);

module.exports = router;