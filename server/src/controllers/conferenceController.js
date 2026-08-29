// server/src/controllers/conferenceController.js
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Conference,
  ConferenceParticipant,
  User,
  Organization,
  Event,
  EventRegistration
} = require('../models');
const livekit = require('../services/livekitService');
const logger = require('../utils/logger');

const HOST_ROLES = ['tpo', 'admin', 'teacher', 'principal', 'school_admin', 'career_counselor'];

/** 503 body used whenever conferencing has not been provisioned yet. */
const notConfigured = (res) =>
  res.status(503).json({
    error: 'Conferencing Unavailable',
    message:
      'Live classes are not configured on this server. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.',
    detail: livekit.configurationError()
  });

/** Short, URL-safe, unguessable room name. */
const generateRoomName = () => `room-${crypto.randomBytes(9).toString('base64url')}`;

const publicConference = (conference, viewerRole = null) => ({
  id: conference.id,
  roomName: conference.roomName,
  title: conference.title,
  description: conference.description,
  status: conference.status,
  scheduledStart: conference.scheduledStart,
  scheduledEnd: conference.scheduledEnd,
  startedAt: conference.startedAt,
  endedAt: conference.endedAt,
  access: conference.access,
  maxParticipants: conference.maxParticipants,
  settings: {
    allowAttendeeVideo: conference.allowAttendeeVideo,
    allowAttendeeScreenShare: conference.allowAttendeeScreenShare,
    allowAttendeeAudio: conference.allowAttendeeAudio,
    muteOnEntry: conference.muteOnEntry,
    allowChat: conference.allowChat
  },
  host: conference.host
    ? {
        id: conference.host.id,
        firstName: conference.host.firstName,
        lastName: conference.host.lastName
      }
    : undefined,
  organization: conference.organization
    ? { id: conference.organization.id, name: conference.organization.name }
    : undefined,
  eventId: conference.eventId,
  viewerRole
});

/**
 * Decide what a user may do in a conference.
 *
 * Returns { allowed, role, reason }. This is the single place that answers
 * "can this person join, and as what" — the token endpoint and every
 * moderation endpoint go through it.
 */
const resolveRole = async (conference, user) => {
  // Explicit membership row always wins (covers invites, co-hosts and bans).
  const membership = await ConferenceParticipant.findOne({
    where: { conferenceId: conference.id, userId: user.id }
  });

  if (membership?.isBanned) {
    return { allowed: false, reason: 'You have been removed from this session.', membership };
  }

  // The creator and platform admins are always hosts.
  if (conference.hostUserId === user.id || user.role === 'admin') {
    return { allowed: true, role: 'host', membership };
  }

  if (membership && membership.role !== 'attendee') {
    return { allowed: true, role: membership.role, membership };
  }

  switch (conference.access) {
    case 'public':
      return { allowed: true, role: membership?.role || 'attendee', membership };

    case 'invite':
      // Must have been added explicitly.
      return membership
        ? { allowed: true, role: membership.role, membership }
        : { allowed: false, reason: 'This session is invite-only.', membership };

    case 'registered': {
      if (!conference.eventId) {
        return { allowed: false, reason: 'This session is not open for registration.', membership };
      }
      const registration = await EventRegistration.findOne({
        where: {
          eventId: conference.eventId,
          userId: user.id,
          status: { [Op.in]: ['registered', 'attended'] }
        }
      });
      return registration
        ? { allowed: true, role: membership?.role || 'attendee', membership }
        : {
            allowed: false,
            reason: 'Register for this event before joining the session.',
            membership
          };
    }

    case 'organization':
    default:
      if (conference.organizationId && user.organizationId === conference.organizationId) {
        return { allowed: true, role: membership?.role || 'attendee', membership };
      }
      return {
        allowed: false,
        reason: 'This session is limited to members of the hosting institution.',
        membership
      };
  }
};

/** Confirm the caller may moderate; loads the conference as a side effect. */
const requireModerator = async (conferenceId, user) => {
  const conference = await Conference.findByPk(conferenceId);
  if (!conference) return { error: { status: 404, message: 'Conference not found' } };

  const { allowed, role } = await resolveRole(conference, user);
  if (!allowed || (role !== 'host' && role !== 'cohost')) {
    return { error: { status: 403, message: 'Only the host can do this' }, conference };
  }
  return { conference, role };
};

class ConferenceController {
  /* --------------------------------------------------------------- create */
  async createConference(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }

      if (!HOST_ROLES.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Your role cannot host live sessions'
        });
      }

      const {
        title,
        description,
        eventId,
        scheduledStart,
        scheduledEnd,
        access = 'organization',
        maxParticipants,
        settings = {}
      } = req.body;

      const conference = await Conference.create({
        roomName: generateRoomName(),
        title,
        description,
        hostUserId: req.user.id,
        organizationId: req.user.organizationId || null,
        eventId: eventId || null,
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
        access,
        maxParticipants: Math.min(Number(maxParticipants) || 50, 200),
        allowAttendeeVideo: Boolean(settings.allowAttendeeVideo),
        allowAttendeeScreenShare: Boolean(settings.allowAttendeeScreenShare),
        allowAttendeeAudio: settings.allowAttendeeAudio !== false,
        muteOnEntry: settings.muteOnEntry !== false,
        allowChat: settings.allowChat !== false
      });

      await ConferenceParticipant.create({
        conferenceId: conference.id,
        userId: req.user.id,
        role: 'host'
      });

      logger.info('Conference created', {
        conferenceId: conference.id,
        roomName: conference.roomName,
        hostUserId: req.user.id
      });

      res.status(201).json({
        message: 'Conference created successfully',
        conference: publicConference(conference, 'host')
      });
    } catch (error) {
      next(error);
    }
  }

  /* ----------------------------------------------------------------- list */
  async listConferences(req, res, next) {
    try {
      const { status, upcoming } = req.query;
      const where = {};

      if (req.user.role !== 'admin') {
        // Everything hosted by you, or belonging to your organization.
        where[Op.or] = [
          { hostUserId: req.user.id },
          ...(req.user.organizationId ? [{ organizationId: req.user.organizationId }] : []),
          { access: 'public' }
        ];
      }
      if (status) where.status = status;
      if (upcoming === 'true') where.status = { [Op.in]: ['scheduled', 'live'] };

      const conferences = await Conference.findAll({
        where,
        include: [
          { model: User, as: 'host', attributes: ['id', 'firstName', 'lastName'] },
          { model: Organization, as: 'organization', attributes: ['id', 'name'] }
        ],
        order: [['scheduledStart', 'ASC'], ['createdAt', 'DESC']],
        limit: 100
      });

      res.json({
        message: 'Conferences retrieved successfully',
        conferences: conferences.map((c) => publicConference(c))
      });
    } catch (error) {
      next(error);
    }
  }

  /* ------------------------------------------------------------------ get */
  async getConference(req, res, next) {
    try {
      const conference = await Conference.findByPk(req.params.id, {
        include: [
          { model: User, as: 'host', attributes: ['id', 'firstName', 'lastName'] },
          { model: Organization, as: 'organization', attributes: ['id', 'name'] },
          { model: Event, as: 'event', attributes: ['id', 'title'] }
        ]
      });
      if (!conference) {
        return res.status(404).json({ error: 'Not Found', message: 'Conference not found' });
      }

      const { allowed, role, reason } = await resolveRole(conference, req.user);

      res.json({
        message: 'Conference retrieved successfully',
        conference: publicConference(conference, allowed ? role : null),
        canJoin: allowed,
        reason: allowed ? undefined : reason
      });
    } catch (error) {
      next(error);
    }
  }

  /* ---------------------------------------------------------------- token */
  /**
   * Mint a LiveKit join token.
   *
   * This endpoint is the security boundary. It re-derives the caller's role
   * from the database on every call, so a ban or a hard-mute applied while the
   * user was away is still in force when they try to come back — LiveKit's
   * own revokeTokenTs only kills the token they were previously holding.
   */
  async getJoinToken(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const conference = await Conference.findByPk(req.params.id);
      if (!conference) {
        return res.status(404).json({ error: 'Not Found', message: 'Conference not found' });
      }
      if (conference.status === 'ended' || conference.status === 'cancelled') {
        return res.status(409).json({
          error: 'Conference Closed',
          message: 'This session has already finished.'
        });
      }

      const { allowed, role, reason, membership } = await resolveRole(conference, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'Access Forbidden', message: reason });
      }

      // Capacity guard — the VPS, not LiveKit, is the limiting factor.
      if (role === 'attendee') {
        try {
          const current = await livekit.listParticipants(conference.roomName);
          if (current.length >= conference.maxParticipants) {
            return res.status(503).json({
              error: 'Session Full',
              message: `This session has reached its limit of ${conference.maxParticipants} participants.`
            });
          }
        } catch (error) {
          // Room may not exist yet — that just means it is empty.
          logger.debug('Could not list participants for capacity check', {
            room: conference.roomName,
            message: error.message
          });
        }
      }

      await livekit.ensureRoom(conference);

      const token = await livekit.createAccessToken({
        conference,
        user: req.user,
        role,
        hardMuted: Boolean(membership?.isHardMuted)
      });

      // Record/refresh the membership row so attendance and moderation have a
      // row to hang off even for open-access joins.
      const now = new Date();
      if (membership) {
        await membership.update({ lastJoinedAt: now });
      } else {
        await ConferenceParticipant.create({
          conferenceId: conference.id,
          userId: req.user.id,
          role,
          firstJoinedAt: now,
          lastJoinedAt: now
        });
      }

      if (role === 'host' && conference.status === 'scheduled') {
        await conference.update({ status: 'live', startedAt: now });
      }

      res.json({
        message: 'Token issued',
        token,
        url: livekit.publicUrl,
        identity: livekit.identityFor(req.user.id),
        role,
        conference: publicConference(conference, role)
      });
    } catch (error) {
      next(error);
    }
  }

  /* --------------------------------------------------------- participants */
  async listLiveParticipants(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const conference = await Conference.findByPk(req.params.id);
      if (!conference) {
        return res.status(404).json({ error: 'Not Found', message: 'Conference not found' });
      }
      const { allowed } = await resolveRole(conference, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'Access Forbidden', message: 'Not permitted' });
      }

      let live = [];
      try {
        live = await livekit.listParticipants(conference.roomName);
      } catch (error) {
        live = [];
      }

      const rows = await ConferenceParticipant.findAll({
        where: { conferenceId: conference.id },
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role'] }]
      });
      const byUserId = new Map(rows.map((r) => [r.userId, r]));

      res.json({
        message: 'Participants retrieved successfully',
        participants: live.map((p) => {
          const userId = livekit.userIdFromIdentity(p.identity);
          const row = userId ? byUserId.get(userId) : null;
          return {
            identity: p.identity,
            name: p.name,
            userId,
            role: row?.role || 'attendee',
            handRaisedAt: row?.handRaisedAt || null,
            isHardMuted: row?.isHardMuted || false,
            joinedAt: p.joinedAt ? Number(p.joinedAt) : null,
            tracks: (p.tracks || []).map((t) => ({ sid: t.sid, source: t.source, muted: t.muted }))
          };
        })
      });
    } catch (error) {
      next(error);
    }
  }

  /* ----------------------------------------------------------------- mute */
  async muteParticipant(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      const targetUserId = Number(req.params.userId);
      const identity = livekit.identityFor(targetUserId);
      // `hard` revokes publish permission so the student cannot simply unmute.
      const hard = req.body?.hard === true;

      await livekit.muteParticipantTracks(conference.roomName, identity, true);

      if (hard) {
        await livekit.setPublishPermission(conference.roomName, identity, false);
        await ConferenceParticipant.update(
          { isHardMuted: true },
          { where: { conferenceId: conference.id, userId: targetUserId } }
        );
      }

      logger.info('Participant muted', {
        conferenceId: conference.id,
        targetUserId,
        hard,
        byUserId: req.user.id
      });

      res.json({ message: hard ? 'Participant hard-muted' : 'Participant muted' });
    } catch (error) {
      next(error);
    }
  }

  /** Restore publishing rights after a hard mute. */
  async unmuteParticipant(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      const targetUserId = Number(req.params.userId);
      const identity = livekit.identityFor(targetUserId);

      const row = await ConferenceParticipant.findOne({
        where: { conferenceId: conference.id, userId: targetUserId }
      });
      const sources = livekit.publishSourcesFor(row?.role || 'attendee', conference);

      await livekit.setPublishPermission(conference.roomName, identity, sources.length > 0, sources);
      if (row) await row.update({ isHardMuted: false });

      // LiveKit will not unmute a track on the participant's behalf — the
      // client still has to opt in — so tell them their rights are back.
      await livekit
        .sendData(conference.roomName, { type: 'publish-restored' }, [identity])
        .catch(() => {});

      res.json({ message: 'Publishing restored' });
    } catch (error) {
      next(error);
    }
  }

  async muteAll(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      // Hosts and co-hosts keep their audio.
      const moderators = await ConferenceParticipant.findAll({
        where: { conferenceId: conference.id, role: { [Op.in]: ['host', 'cohost'] } },
        attributes: ['userId']
      });
      const exempt = moderators.map((m) => livekit.identityFor(m.userId));

      const muted = await livekit.muteEveryone(conference.roomName, exempt);

      logger.info('Mute-all issued', { conferenceId: conference.id, byUserId: req.user.id, muted });
      res.json({ message: 'All participants muted', tracksMuted: muted });
    } catch (error) {
      next(error);
    }
  }

  /* ----------------------------------------------------------------- kick */
  async removeParticipant(req, res, next) {
    try {
      if (!livekit.isConfigured()) return notConfigured(res);

      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      const targetUserId = Number(req.params.userId);
      if (targetUserId === conference.hostUserId) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'The host cannot be removed from their own session'
        });
      }

      const identity = livekit.identityFor(targetUserId);
      const permanent = req.body?.ban !== false; // default: block rejoin

      // Persist the ban FIRST. removeParticipant's revokeTokenTs invalidates
      // the token the user currently holds, but nothing stops them asking us
      // for a fresh one — the token endpoint checks this flag.
      if (permanent) {
        await ConferenceParticipant.update(
          { isBanned: true, bannedAt: new Date() },
          { where: { conferenceId: conference.id, userId: targetUserId } }
        );
      }

      await livekit.removeParticipant(conference.roomName, identity);

      logger.info('Participant removed', {
        conferenceId: conference.id,
        targetUserId,
        permanent,
        byUserId: req.user.id
      });

      res.json({ message: permanent ? 'Participant removed and blocked' : 'Participant removed' });
    } catch (error) {
      next(error);
    }
  }

  /** Undo a ban so the student can rejoin. */
  async readmitParticipant(req, res, next) {
    try {
      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      await ConferenceParticipant.update(
        { isBanned: false, bannedAt: null },
        { where: { conferenceId: conference.id, userId: Number(req.params.userId) } }
      );
      res.json({ message: 'Participant may rejoin' });
    } catch (error) {
      next(error);
    }
  }

  /* ----------------------------------------------------------- raise hand */
  /**
   * Persist hand state.
   *
   * The client also sets a LiveKit participant attribute for instant feedback;
   * this endpoint is what makes the queue survive a reload and gives the host
   * a stable, server-ordered list.
   */
  async setHand(req, res, next) {
    try {
      const conference = await Conference.findByPk(req.params.id);
      if (!conference) {
        return res.status(404).json({ error: 'Not Found', message: 'Conference not found' });
      }
      const { allowed } = await resolveRole(conference, req.user);
      if (!allowed) {
        return res.status(403).json({ error: 'Access Forbidden', message: 'Not permitted' });
      }

      const raised = req.body?.raised === true;
      await ConferenceParticipant.update(
        { handRaisedAt: raised ? new Date() : null },
        { where: { conferenceId: conference.id, userId: req.user.id } }
      );

      // Broadcast so hosts update without polling.
      await livekit
        .sendData(conference.roomName, {
          type: 'hand',
          userId: req.user.id,
          identity: livekit.identityFor(req.user.id),
          raised
        })
        .catch(() => {});

      res.json({ message: raised ? 'Hand raised' : 'Hand lowered', raised });
    } catch (error) {
      next(error);
    }
  }

  /** Host lowers someone else's hand (or their own). */
  async lowerHand(req, res, next) {
    try {
      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      const targetUserId = Number(req.params.userId);
      await ConferenceParticipant.update(
        { handRaisedAt: null },
        { where: { conferenceId: conference.id, userId: targetUserId } }
      );
      await livekit
        .sendData(conference.roomName, {
          type: 'hand',
          userId: targetUserId,
          identity: livekit.identityFor(targetUserId),
          raised: false
        })
        .catch(() => {});

      res.json({ message: 'Hand lowered' });
    } catch (error) {
      next(error);
    }
  }

  /* ------------------------------------------------------------ lifecycle */
  async endConference(req, res, next) {
    try {
      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      if (livekit.isConfigured()) {
        await livekit.deleteRoom(conference.roomName).catch((err) =>
          logger.warn('deleteRoom failed', { room: conference.roomName, message: err.message })
        );
      }
      await conference.update({ status: 'ended', endedAt: new Date() });

      res.json({ message: 'Conference ended' });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { conference, error } = await requireModerator(req.params.id, req.user);
      if (error) return res.status(error.status).json({ error: 'Forbidden', message: error.message });

      const s = req.body?.settings || {};
      const patch = {};
      ['allowAttendeeVideo', 'allowAttendeeScreenShare', 'allowAttendeeAudio', 'muteOnEntry', 'allowChat']
        .forEach((key) => {
          if (typeof s[key] === 'boolean') patch[key] = s[key];
        });
      if (req.body?.title) patch.title = req.body.title;

      await conference.update(patch);

      // Existing tokens already encode the old permissions, so tell clients to
      // re-fetch rather than silently leaving them on stale grants.
      if (livekit.isConfigured() && Object.keys(patch).length) {
        await livekit
          .sendData(conference.roomName, { type: 'settings-changed' })
          .catch(() => {});
      }

      res.json({
        message: 'Settings updated',
        conference: publicConference(conference, 'host')
      });
    } catch (error) {
      next(error);
    }
  }

  /* --------------------------------------------------------------- webhook */
  /**
   * LiveKit webhook receiver.
   * Requires the RAW body — the route mounts express.raw() for this path.
   */
  async handleWebhook(req, res) {
    try {
      if (!livekit.isConfigured()) return res.status(503).end();

      const event = livekit.receiveWebhook(req.body, req.get('Authorization'));
      const roomName = event?.room?.name;
      const identity = event?.participant?.identity;
      const userId = identity ? livekit.userIdFromIdentity(identity) : null;

      if (roomName && userId) {
        const conference = await Conference.findOne({ where: { roomName } });
        if (conference) {
          const now = new Date();
          if (event.event === 'participant_joined') {
            await ConferenceParticipant.update(
              { lastJoinedAt: now },
              { where: { conferenceId: conference.id, userId } }
            );
          } else if (event.event === 'participant_left') {
            const row = await ConferenceParticipant.findOne({
              where: { conferenceId: conference.id, userId }
            });
            if (row) {
              const seconds = row.lastJoinedAt
                ? Math.max(0, Math.round((now - new Date(row.lastJoinedAt)) / 1000))
                : 0;
              await row.update({
                lastLeftAt: now,
                totalSeconds: row.totalSeconds + seconds,
                handRaisedAt: null
              });
            }
          }
        }
      }

      if (event?.event === 'room_finished' && roomName) {
        await Conference.update(
          { status: 'ended', endedAt: new Date() },
          { where: { roomName, status: { [Op.ne]: 'ended' } } }
        );
      }

      res.status(200).end();
    } catch (error) {
      // Never 500 at a webhook — LiveKit will retry and amplify the problem.
      logger.warn('LiveKit webhook rejected', { message: error.message });
      res.status(200).end();
    }
  }
}

module.exports = new ConferenceController();
module.exports.resolveRole = resolveRole;
