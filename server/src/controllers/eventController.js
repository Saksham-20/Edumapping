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

const pickEventFields = (body) => {
  const out = {};
  for (const field of EVENT_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
};

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
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      // Determine organizationId (admins may not be tied to an org)
      let resolvedOrganizationId = req.user.organizationId;
      if (req.user.role === 'admin' && !resolvedOrganizationId) {
        resolvedOrganizationId = req.body.organizationId ? parseInt(req.body.organizationId) : null;
        if (!resolvedOrganizationId) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'organizationId is required for admin'
          });
        }

        // Validate organization exists (clean 400 instead of FK error)
        const orgExists = await Organization.findByPk(resolvedOrganizationId, { attributes: ['id'] });
        if (!orgExists) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid organizationId'
          });
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
          message: 'Only admins can create EduMapping (global) events'
        });
      }

      const event = await Event.create(eventData);

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
        limit = 10,
        eventType,
        status,
        organizationId,
        upcoming = false,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = {};

      if (eventType) whereClause.eventType = eventType;

      // Default behavior: if status is omitted, do NOT filter by status (so new events show up).
      // Client can pass status=scheduled for "Upcoming", or status=all for "All events".
      if (status && status !== 'all') {
        whereClause.status = status;
      }
      
      // Handle upcoming filter
      if (upcoming === 'true' || upcoming === true) {
        whereClause.startTime = { [Op.gte]: new Date() };
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
        limit: parseInt(limit),
        offset: parseInt(offset),
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
          const userRegistration = event.registrations?.find(reg => reg.userId === req.user.id);
          eventData.userRegistration = userRegistration;
        }
        
        delete eventData.registrations;
        return eventData;
      });

      res.json({
        message: 'Events retrieved successfully',
        events: eventsWithCounts,
        pagination: {
          currentPage: parseInt(page),
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
        ? registrations.find((reg) => reg.userId === req.user.id) || null
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
          message: 'This event is not accepting registrations'
        });
      }

      // Check registration deadline
      if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
        return res.status(400).json({
          error: 'Registration Deadline Passed',
          message: 'Registration deadline has passed'
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
          message: 'You have already registered for this event'
        });
      }

      // Check max participants
      if (event.maxParticipants) {
        const currentRegistrations = await EventRegistration.count({
          where: { eventId: id, status: 'registered' }
        });

        if (currentRegistrations >= event.maxParticipants) {
          return res.status(400).json({
            error: 'Event Full',
            message: 'This event has reached maximum capacity'
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
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }

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
          message: 'You can only update events from your organization'
        });
      }

      // The route declares validators; nothing read their result, so they
      // were never enforced.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }

      const updates = pickEventFields(req.body);

      // Only an admin may move an event between organizations — including into
      // or out of the global EduMapping one, which is visible to everyone.
      if (req.user.role === 'admin' && req.body.organizationId !== undefined) {
        const targetOrgId = parseInt(req.body.organizationId, 10);
        const target = Number.isInteger(targetOrgId)
          ? await Organization.findByPk(targetOrgId, { attributes: ['id'] })
          : null;
        if (!target) {
          return res.status(400).json({ error: 'Validation Error', message: 'Invalid organizationId' });
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