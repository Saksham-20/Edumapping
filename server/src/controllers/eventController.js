// server/src/controllers/eventController.js
const { Event, Organization, User, EventRegistration } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

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

class EventController {
  async createEvent(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
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
        ...req.body,
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
        upcoming = false
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

      // For students, show events from their university and all company events
      if (req.user && req.user.role === 'student') {
        // Don't filter by organizationId for students - they should see all relevant events
        // This will show events from their university and company events
      } else if (req.user && req.user.role === 'recruiter') {
        // Recruiters only see events from their organization
        // Use query param if provided, otherwise use user's organizationId
        const orgId = organizationId || req.user.organizationId;
        const eduMappingOrgId = await getEduMappingOrgId();
        if (eduMappingOrgId) {
          whereClause[Op.or] = [
            { organizationId: orgId },
            { organizationId: eduMappingOrgId }
          ];
        } else {
          whereClause.organizationId = orgId;
        }
      } else if (req.user && req.user.role === 'tpo') {
        // TPOs see events from their university
        // Use query param if provided, otherwise use user's organizationId
        const orgId = organizationId || req.user.organizationId;
        const eduMappingOrgId = await getEduMappingOrgId();
        if (eduMappingOrgId) {
          whereClause[Op.or] = [
            { organizationId: orgId },
            { organizationId: eduMappingOrgId }
          ];
        } else {
          whereClause.organizationId = orgId;
        }
      } else if (organizationId) {
        // For unauthenticated or other roles, use query param if provided
        whereClause.organizationId = organizationId;
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
            attributes: ['id', 'status']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['startTime', 'ASC']]
      });

      const eventsWithCounts = events.map(event => {
        const eventData = event.toJSON();
        eventData.registrationCount = event.registrations ? event.registrations.length : 0;
        
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
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
          {
            model: EventRegistration,
            as: 'registrations',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email']
              }
            ]
          }
        ]
      });

      if (!event) {
        return res.status(404).json({
          error: 'Event Not Found',
          message: 'Event not found'
        });
      }

      // Check if current user is registered
      let userRegistration = null;
      if (req.user && event.registrations) {
        userRegistration = event.registrations.find(reg => reg.userId === req.user.id);
      }

      const eventData = event.toJSON();
      eventData.userRegistration = userRegistration;
      eventData.registrationCount = event.registrations ? event.registrations.length : 0;

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
      if (!event) {
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

      if (existingRegistration) {
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

      const registration = await EventRegistration.create({
        eventId: id,
        userId,
        status: 'registered'
      });

      res.status(201).json({
        message: 'Successfully registered for event',
        registration
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

      await event.update(req.body);

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