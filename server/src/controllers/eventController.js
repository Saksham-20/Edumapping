// server/src/controllers/eventController.js
const {
  Event,
  Organization,
  User,
  EventRegistration,
  RecruiterProfile,
  RecruiterAllowedOrganization
} = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

let cachedEduMappingOrgId = undefined;
const getEduMappingOrgId = async () => {
  if (cachedEduMappingOrgId !== undefined) return cachedEduMappingOrgId;
  const org = await Organization.findOne({
    where: { name: { [Op.iLike]: 'EduMapping' } },
    attributes: ['id']
  });
  cachedEduMappingOrgId = org ? org.id : null;
  return cachedEduMappingOrgId;
};

// What an organizer may write on an event. Both create and update used to
// spread `req.body` onto the row, so an update could move an event to another
// organization (or into the global EduMapping one) or rewrite `createdBy`.
const EVENT_FIELDS = [
  'title',
  'description',
  'eventType',
  'startTime',
  'endTime',
  'location',
  'virtualLink',
  'maxParticipants',
  'registrationDeadline',
  'status'
];

// Optional columns a form clears by sending "". Stored as NULL, not "", so a
// cleared meeting link or limit really goes away (and "" never reaches the
// model's isUrl check or an INTEGER column).
const NULLABLE_FIELDS = ['location', 'virtualLink', 'maxParticipants', 'registrationDeadline'];

const pickEventFields = (body) => {
  const out = {};
  for (const field of EVENT_FIELDS) {
    if (body[field] === undefined) continue;
    out[field] = NULLABLE_FIELDS.includes(field) && body[field] === '' ? null : body[field];
  }
  return out;
};

/** The house validation shape: a readable `message` plus per-field details. */
const validationFailed = (res, errors) => {
  const details = errors.array().map(({ path, msg }) => ({ field: path || 'event', message: msg }));
  return res.status(400).json({
    error: 'Validation Error',
    message: details[0]?.message || 'Some details need fixing.',
    details
  });
};

const fieldError = (res, field, message, status = 400) =>
  res.status(status).json({ error: 'Validation Error', message, details: [{ field, message }] });

/** Registrations that hold a seat: everyone who signed up and has not cancelled. */
const SEAT_STATUSES = ['registered', 'attended'];

// Roles that run an organization's events (everyone but students).
const ORGANIZER_ROLES = ['tpo', 'recruiter', 'principal', 'teacher', 'school_admin', 'career_counselor'];

/**
 * Company organizations that recruit at an institution: companies with a
 * recruiter whose allow-list contains it. Their events (info sessions, drives)
 * are meant for that institution's students.
 */
const companiesRecruitingAt = async (institutionId) => {
  if (!institutionId) return [];
  const rows = await RecruiterAllowedOrganization.findAll({
    where: { organizationId: institutionId },
    attributes: ['id'],
    include: [{
      model: RecruiterProfile,
      as: 'recruiterProfile',
      attributes: ['id'],
      required: true,
      include: [{ model: User, as: 'user', attributes: ['organizationId'], required: true }]
    }]
  });
  return [...new Set(rows.map((r) => r.recruiterProfile.user.organizationId).filter(Boolean))];
};

/**
 * The organizations whose events a user may see, or null for "all" (admin).
 *
 * One rule shared by the listing, the detail view and registration, so they
 * cannot disagree. It used to be per-endpoint: students and anonymous callers
 * saw every organization's events (and could register for a different
 * school's), while a TPO or recruiter could widen their own view by passing
 * `?organizationId=` for somebody else's institution.
 *
 *   * everyone: global events (the EduMapping organization);
 *   * signed in: their own organization's events;
 *   * students and TPOs of a college/university: also events of the companies
 *     that recruit there (an info session is for those students).
 */
const visibleEventOrgIds = async (user) => {
  if (user?.role === 'admin') return null;
  const ids = new Set();
  const eduMappingOrgId = await getEduMappingOrgId();
  if (eduMappingOrgId) ids.add(eduMappingOrgId);
  if (user?.organizationId) {
    ids.add(user.organizationId);
    const orgType = user.organization?.type;
    if (['student', 'tpo'].includes(user.role) && ['university', 'college'].includes(orgType)) {
      (await companiesRecruitingAt(user.organizationId)).forEach((id) => ids.add(id));
    }
  }
  return [...ids];
};

/** Organizer of this event: admin, its author, or organizer-role staff of its organization. */
const isEventOrganizer = (user, event) =>
  !!user &&
  (user.role === 'admin' ||
    event.createdBy === user.id ||
    (ORGANIZER_ROLES.includes(user.role) &&
      !!user.organizationId &&
      user.organizationId === event.organizationId));

/** May this user see this event at all? Drafts only to organizers. */
const canSeeEvent = async (user, event) => {
  if (isEventOrganizer(user, event)) return true;
  if (event.status === 'draft') return false;
  const orgIds = await visibleEventOrgIds(user);
  if (orgIds === null || orgIds.includes(event.organizationId)) return true;
  // Someone already registered (an organizer added them, or the rules were
  // wider when they signed up) can still open the event they are attending.
  if (user?.id) {
    const own = await EventRegistration.findOne({ where: { eventId: event.id, userId: user.id }, attributes: ['id'] });
    return !!own;
  }
  return false;
};

class EventController {
  async createEvent(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailed(res, errors);

      // A brand-new event that already started is almost always a wrong date
      // (AM/PM, or last year). Five minutes of slack for "starting now".
      if (new Date(req.body.startTime).getTime() < Date.now() - 5 * 60 * 1000) {
        return fieldError(res, 'startTime', 'The start time is in the past. Pick a future date and time.');
      }

      // Determine organizationId (admins may not be tied to an org)
      let resolvedOrganizationId = req.user.organizationId;
      if (req.user.role === 'admin' && !resolvedOrganizationId) {
        resolvedOrganizationId = req.body.organizationId ? parseInt(req.body.organizationId) : null;
        if (!resolvedOrganizationId) {
          return fieldError(res, 'organizationId', 'Choose which organization is running this event');
        }

        // Validate organization exists (clean 400 instead of FK error)
        const orgExists = await Organization.findByPk(resolvedOrganizationId, { attributes: ['id'] });
        if (!orgExists) {
          return fieldError(res, 'organizationId', 'That organization no longer exists. Choose another one.');
        }
      }

      // Default new events to scheduled unless explicitly set (prevents "created but not visible" confusion)
      const resolvedStatus = req.body.status || 'scheduled';

      const eventData = {
        ...pickEventFields(req.body),
        organizationId: resolvedOrganizationId,
        createdBy: req.user.id,
        status: resolvedStatus
      };

      // Only admin may create events under the EduMapping org (global events)
      const eduMappingOrgId = await getEduMappingOrgId();
      if (eduMappingOrgId && eventData.organizationId === eduMappingOrgId && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Only EduMapping admins can create events shown to every institution.'
        });
      }

      const event = await Event.create(eventData);

      // Students of a non-global organisation hear about it in the bell;
      // they used to find out only by visiting the events page.
      if (!(eduMappingOrgId && event.organizationId === eduMappingOrgId)) {
        notificationService.notifyStudentsOfNewEvent(event);
      }

      const eventWithDetails = await Event.findByPk(event.id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.status(201).json({
        message: 'Event created successfully',
        event: eventWithDetails
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllEvents(req, res, next) {
    try {
      const {
        page = 1,
        eventType,
        status,
        organizationId,
        upcoming = false,
        registered,
        search
      } = req.query;

      // Bounded so `?limit=100000` cannot pull the whole table with joins.
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
      const whereClause = {};

      if (eventType) whereClause.eventType = eventType;

      // Default behavior: if status is omitted, do NOT filter by status (so new events show up).
      // Client can pass status=scheduled for "Upcoming", or status=all for "All events".
      if (status && status !== 'all') {
        whereClause.status = status;
      }
      
      // Handle upcoming filter
      // "Upcoming" means not over yet. Filtering on startTime hid an event
      // the moment it began, so a student could not find the workshop that
      // was running right now to open its meeting link.
      if (upcoming === 'true' || upcoming === true) {
        whereClause.endTime = { [Op.gte]: new Date() };
      }

      // Scope to the organizations this user may see (see visibleEventOrgIds).
      // `organizationId` only narrows within that set; it can no longer widen
      // a TPO's or recruiter's view to another institution's events.
      const visibleOrgIds = await visibleEventOrgIds(req.user);
      if (visibleOrgIds === null) {
        if (organizationId) whereClause.organizationId = organizationId;
      } else {
        const requested = organizationId ? parseInt(organizationId, 10) : null;
        whereClause.organizationId = requested
          ? (visibleOrgIds.includes(requested) ? requested : -1)
          : { [Op.in]: visibleOrgIds };

        // Drafts belong to their organizers only.
        const organizerOrg = ORGANIZER_ROLES.includes(req.user?.role) ? req.user.organizationId : null;
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          organizerOrg
            ? { [Op.or]: [{ status: { [Op.ne]: 'draft' } }, { organizationId: organizerOrg }] }
            : { status: { [Op.ne]: 'draft' } }
        ];
      }

      // Free-text search. This has to go through Op.and rather than assigning
      // whereClause[Op.or]: the recruiter and TPO branches above already use
      // Op.or to scope an event to the user's own organization plus the global
      // EduMapping one. Overwriting that key would widen a scoped query into
      // every organization's events the moment someone typed in the search box.
      if (search) {
        const term = `%${search}%`;
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          {
            [Op.or]: [
              { title: { [Op.iLike]: term } },
              { description: { [Op.iLike]: term } },
              { location: { [Op.iLike]: term } }
            ]
          }
        ];
      }

      // "My events": only the ones the caller holds a live registration for.
      // The tab used to send no filter at all and showed every event.
      if ((registered === 'true' || registered === true) && req.user) {
        const mine = await EventRegistration.findAll({
          where: { userId: req.user.id, status: { [Op.ne]: 'cancelled' } },
          attributes: ['eventId']
        });
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          { id: { [Op.in]: mine.length ? mine.map((r) => r.eventId) : [-1] } }
        ];
      }

      const { count, rows: events } = await Event.findAndCountAll({
        where: whereClause,
        include: [
          { 
            model: Organization, 
            as: 'organization',
            attributes: ['id', 'name', 'type', 'logoUrl']
          },
          {
            model: EventRegistration,
            as: 'registrations',
            // `userId` is needed below to tell whether the caller is
            // registered. Without it `reg.userId` was always undefined, so the
            // match never succeeded and `userRegistration` came back unset on
            // every event — which is why the "Registered" badge never appeared.
            attributes: ['id', 'status', 'userId']
          }
        ],
        limit,
        offset,
        // Count distinct events, not joined rows. `registrations` is a hasMany,
        // so without this an event with three sign-ups counted three times and
        // the reported total — and therefore the page count — was inflated,
        // offering pages that come back empty.
        distinct: true,
        order: [['startTime', 'ASC']]
      });

      const eventsWithCounts = events.map(event => {
        const eventData = event.toJSON();
        // Cancelled rows stay in the table (so a user can re-register), and
        // were being counted as sign-ups.
        eventData.registrationCount = (event.registrations || []).filter(
          (reg) => reg.status !== 'cancelled'
        ).length;

        // Check if current user is registered for this event
        if (req.user) {
          // A cancelled row is not a registration; reporting it made the card
          // say "Registered" for someone who had cancelled.
          const userRegistration = event.registrations?.find(
            (reg) => reg.userId === req.user.id && reg.status !== 'cancelled'
          );
          eventData.userRegistration = userRegistration || null;
        }
        
        delete eventData.registrations;
        return eventData;
      });

      res.json({
        message: 'Events retrieved successfully',
        events: eventsWithCounts,
        pagination: {
          currentPage: Math.max(parseInt(page, 10) || 1, 1),
          totalPages: Math.ceil(count / limit),
          totalEvents: count,
          hasMore: offset + events.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req, res, next) {
    try {
      const { id } = req.params;

      const event = await Event.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      // Out of scope reads as not found, so event ids elsewhere are not confirmed.
      if (!event || !(await canSeeEvent(req.user, event))) {
        return res.status(404).json({
          error: 'Event Not Found',
          message: 'Event not found'
        });
      }

      // Who registered is the organizer's business. This endpoint is
      // optionalAuth and returned every registrant's name and email to anyone,
      // anonymous visitors included — for school events, minors' addresses.
      // Organizers get the list; everyone else gets the count and, if signed
      // in, their own row (the client reads `registrations` to find it).
      const organizer = isEventOrganizer(req.user, event);
      const registrations = await EventRegistration.findAll({
        where: organizer ? { eventId: event.id } : { eventId: event.id, userId: req.user?.id || -1 },
        include: organizer
          ? [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }]
          : []
      });
      const registrationCount = await EventRegistration.count({
        where: { eventId: event.id, status: { [Op.ne]: 'cancelled' } }
      });

      const userRegistration = req.user
        ? registrations.find((reg) => reg.userId === req.user.id && reg.status !== 'cancelled') || null
        : null;

      const eventData = event.toJSON();
      eventData.registrations = registrations.map((r) => r.toJSON());
      eventData.userRegistration = userRegistration;
      eventData.registrationCount = registrationCount;

      res.json({
        message: 'Event retrieved successfully',
        event: eventData
      });
    } catch (error) {
      next(error);
    }
  }

  async registerForEvent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const event = await Event.findByPk(id);
      // Same visibility rule as the listing: a student could previously sign up
      // for any institution's event by id, including another school's.
      if (!event || !(await canSeeEvent(req.user, event))) {
        return res.status(404).json({
          error: 'Event Not Found',
          message: 'Event not found'
        });
      }

      // Check if event is still accepting registrations
      if (event.status !== 'scheduled') {
        return res.status(400).json({
          error: 'Registration Closed',
          message:
            event.status === 'cancelled'
              ? 'This event has been cancelled, so registration is closed.'
              : 'This event is not taking registrations right now.'
        });
      }

      // Check registration deadline. Without one, registration closes when
      // the event starts — the same rule the event pages show, so the server
      // no longer accepts a sign-up for an event that is already over.
      const now = new Date();
      if (event.registrationDeadline && now > new Date(event.registrationDeadline)) {
        return res.status(400).json({
          error: 'Registration Deadline Passed',
          message: 'Registration for this event has closed.'
        });
      }
      if (!event.registrationDeadline && now >= new Date(event.startTime)) {
        return res.status(400).json({
          error: 'Registration Closed',
          message: 'This event has already started, so registration is closed.'
        });
      }

      // Check if user already registered
      const existingRegistration = await EventRegistration.findOne({
        where: { eventId: id, userId }
      });

      // A cancelled registration must not block signing up again. This used to
      // 409 on any existing row at all, so cancelling once locked the user out
      // of the event permanently — the row survives cancellation, it just moves
      // to status 'cancelled'.
      if (existingRegistration && existingRegistration.status !== 'cancelled') {
        return res.status(409).json({
          error: 'Already Registered',
          message: 'You are already registered for this event.'
        });
      }

      // Check max participants
      if (event.maxParticipants) {
        const currentRegistrations = await EventRegistration.count({
          where: { eventId: id, status: { [Op.in]: SEAT_STATUSES } }
        });

        if (currentRegistrations >= event.maxParticipants) {
          return res.status(400).json({
            error: 'Event Full',
            message: 'This event is full. All seats have been taken.'
          });
        }
      }

      // Reactivate the cancelled row rather than inserting a second one:
      // (event_id, user_id) is UNIQUE, so a fresh create would hit a constraint
      // violation instead of re-registering the user.
      let registration;
      if (existingRegistration) {
        registration = await existingRegistration.update({ status: 'registered' });
      } else {
        registration = await EventRegistration.create({
          eventId: id,
          userId,
          status: 'registered'
        });
      }

      res.status(201).json({
        message: 'Successfully registered for event',
        registration
      });
    } catch (error) {
      // A double tap sends two requests; the second loses the race on the
      // (event_id, user_id) unique key. That is "already registered", not a 500.
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          error: 'Already Registered',
          message: 'You are already registered for this event.'
        });
      }
      next(error);
    }
  }

  /**
   * The registration list for an event, for whoever runs it.
   *
   * There was no way to see who had signed up — `POST /:id/register` and
   * `/:id/cancel` were the only two routes that touched a registration, both
   * from the attendee's side. An organiser could not take a register.
   */
  async listEventRegistrations(req, res, next) {
    try {
      const { id } = req.params;
      const event = await Event.findByPk(id);
      if (!event) {
        return res.status(404).json({ error: 'Event Not Found', message: 'Event not found' });
      }
      if (req.user.role !== 'admin' && event.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only view registrations for your own organization\'s events'
        });
      }

      const registrations = await EventRegistration.findAll({
        where: { eventId: id },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'organizationId']
          }
        ],
        order: [['registeredAt', 'ASC']]
      });

      const counts = registrations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        message: 'Registrations retrieved successfully',
        registrations,
        counts,
        total: registrations.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark attendance for one or many registrations.
   *
   * `EventRegistration.status` has carried 'attended' and 'no_show' since the
   * first migration, and the UI even has a colour ready for a no-show, but
   * nothing in the codebase could ever write either value. Without attendance
   * a workshop cannot report turnout against sign-ups, cannot issue a
   * certificate, and cannot enforce a no-show policy.
   */
  async markEventAttendance(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailed(res, errors);

      const { id } = req.params;
      const { userIds, status } = req.body;

      const event = await Event.findByPk(id);
      if (!event) {
        return res.status(404).json({ error: 'Event Not Found', message: 'Event not found' });
      }
      if (req.user.role !== 'admin' && event.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only mark attendance for your own organization\'s events'
        });
      }

      // Scoped to this event's registrations, so a stray user id cannot be used
      // to touch a row belonging to a different event.
      const [updatedCount] = await EventRegistration.update(
        { status },
        { where: { eventId: id, userId: { [Op.in]: userIds } } }
      );

      logger.info('Event attendance marked', {
        eventId: id,
        status,
        requested: userIds.length,
        updated: updatedCount,
        by: req.user.id
      });

      res.json({
        message: `${updatedCount} registration${updatedCount === 1 ? '' : 's'} marked ${status}`,
        updatedCount,
        status
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const event = await Event.findByPk(id);

      if (!event) {
        return res.status(404).json({
          error: 'Event Not Found',
          message: 'Event not found'
        });
      }

      // Check permissions
      if (req.user.role !== 'admin' && event.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only edit events run by your own institution.'
        });
      }

      // The route declares validators; nothing read their result, so they
      // were never enforced.
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailed(res, errors);

      const updates = pickEventFields(req.body);

      // Lowering the limit below the people already holding seats would show
      // the event as over-full and silently strand them.
      if (updates.maxParticipants) {
        const taken = await EventRegistration.count({
          where: { eventId: event.id, status: { [Op.in]: SEAT_STATUSES } }
        });
        if (updates.maxParticipants < taken) {
          return fieldError(
            res,
            'maxParticipants',
            `${taken} people are already registered. Set the limit to ${taken} or more, or leave it empty for no limit.`
          );
        }
      }

      // Only an admin may move an event between organizations — including into
      // or out of the global EduMapping one, which is visible to everyone.
      if (req.user.role === 'admin' && req.body.organizationId !== undefined) {
        const targetOrgId = parseInt(req.body.organizationId, 10);
        const target = Number.isInteger(targetOrgId)
          ? await Organization.findByPk(targetOrgId, { attributes: ['id'] })
          : null;
        if (!target) {
          return fieldError(res, 'organizationId', 'That organization no longer exists. Choose another one.');
        }
        updates.organizationId = targetOrgId;
      }

      await event.update(updates);

      const updatedEvent = await Event.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.json({
        message: 'Event updated successfully',
        event: updatedEvent
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an event. There was no way to remove one at all — a mistyped event
   * stayed on every student's list. Only allowed while nobody holds a seat:
   * deleting would cascade their registrations away without telling them, so
   * an event people signed up for has to be cancelled instead (it stays
   * visible, marked cancelled).
   */
  async deleteEvent(req, res, next) {
    try {
      const event = await Event.findByPk(req.params.id);
      if (!event || !(await canSeeEvent(req.user, event))) {
        return res.status(404).json({ error: 'Event Not Found', message: 'Event not found' });
      }
      if (req.user.role !== 'admin' && event.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only delete events run by your own institution.'
        });
      }

      const taken = await EventRegistration.count({
        where: { eventId: event.id, status: { [Op.ne]: 'cancelled' } }
      });
      if (taken > 0) {
        return res.status(409).json({
          error: 'Event Has Registrations',
          message: `${taken} ${taken === 1 ? 'person has' : 'people have'} registered for this event. Edit it and set the status to Cancelled instead, so they can see it is not happening.`
        });
      }

      await event.destroy();
      logger.info('Event deleted', { eventId: event.id, by: req.user.id });
      res.json({ message: 'Event deleted' });
    } catch (error) {
      next(error);
    }
  }

  async cancelEventRegistration(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const registration = await EventRegistration.findOne({
        where: { eventId: id, userId }
      });

      if (!registration) {
        return res.status(404).json({
          error: 'Registration Not Found',
          message: 'You are not registered for this event'
        });
      }

      // Attendance already taken is the organiser's record, not the student's
      // to erase: cancelling turned an "attended" row back into a no-sign-up.
      if (registration.status === 'attended' || registration.status === 'no_show') {
        return res.status(400).json({
          error: 'Attendance Recorded',
          message: 'Your attendance for this event has already been recorded, so the registration cannot be cancelled.'
        });
      }

      // Once registration has closed the seat is final — the event pages stop
      // offering "Cancel" at that point, and a seat freed after the deadline is
      // one nobody else can take. Only the API still allowed it.
      const event = await Event.findByPk(id, { attributes: ['id', 'startTime', 'registrationDeadline', 'status'] });
      const now = new Date();
      const closed =
        event &&
        event.status !== 'cancelled' &&
        (event.registrationDeadline
          ? now > new Date(event.registrationDeadline)
          : now >= new Date(event.startTime));
      if (closed && registration.status !== 'cancelled') {
        return res.status(400).json({
          error: 'Registration Closed',
          message: 'Registration for this event has closed, so your place can no longer be cancelled. Contact the organiser if you cannot attend.'
        });
      }

      await registration.update({ status: 'cancelled' });

      res.json({
        message: 'Event registration cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EventController();