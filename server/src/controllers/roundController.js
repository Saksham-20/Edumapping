// server/src/controllers/roundController.js
//
// Selection rounds within a drive — online test, GD, technical, HR — each with
// its own schedule, venue and shortlist, and a result per student.
//
// Who may do what:
//   recruiter — rounds of their own company's jobs, any campus
//   tpo       — rounds at their own campus, for any job their students can
//               apply to; participants limited to their own students
//   admin     — everything
//   student   — reads their own rounds via /mine
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { validationResult } = require('express-validator');
const {
  JobRound,
  RoundParticipant,
  Application,
  Job,
  User,
  StudentProfile,
  Organization,
  AuditLog
} = require('../models');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const ROUND_FIELDS = ['name', 'roundType', 'scheduledAt', 'endsAt', 'mode', 'venue', 'meetingLink', 'instructions', 'status', 'sequence'];
const pick = (src, keys) =>
  keys.reduce((acc, k) => {
    if (src[k] !== undefined) acc[k] = src[k] === '' ? null : src[k];
    return acc;
  }, {});

const fail = (res, status, error, message) => res.status(status).json({ error, message });

const audit = (req, action, entityId, newValues) =>
  AuditLog.create({
    userId: req.user.id,
    action,
    entityType: 'job_round',
    entityId,
    newValues,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  }).catch((err) => logger.error('Audit log failed', err));

/** Can this user manage rounds for this job at all? */
const canManageJob = (user, job) => {
  if (!job) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'recruiter') return job.organizationId === user.organizationId;
  if (user.role === 'tpo') return Boolean(user.organizationId);
  return false;
};

/** Can this user change this particular round? */
const canManageRound = (user, round, job) => {
  if (!canManageJob(user, job)) return false;
  // A TPO edits their own campus's rounds only; a company-wide round belongs
  // to the recruiter who set it.
  if (user.role === 'tpo') return round.organizationId === user.organizationId;
  return true;
};

const describeRound = (round) => {
  const when = round.scheduledAt
    ? new Date(round.scheduledAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
      })
    : 'time to be announced';
  const where = round.mode === 'online' ? 'online' : round.venue || 'venue to be announced';
  return `${when}, ${where}`;
};

class RoundController {
  /** GET /api/rounds?jobId= — rounds of a job, with participant counts. */
  async listForJob(req, res, next) {
    try {
      const jobId = parseInt(req.query.jobId, 10);
      if (!jobId) return fail(res, 400, 'Validation Error', 'jobId is required');
      const job = await Job.findByPk(jobId);
      if (!job) return fail(res, 404, 'Job Not Found', 'Job not found');
      if (!canManageJob(req.user, job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot view the rounds of this job');
      }

      const where = { jobId };
      if (req.user.role === 'tpo') {
        where[Op.or] = [{ organizationId: null }, { organizationId: req.user.organizationId }];
      }

      const participantWhere =
        req.user.role === 'tpo' ? { '$application.student.organization_id$': req.user.organizationId } : {};

      const rounds = await JobRound.findAll({
        where,
        order: [['sequence', 'ASC'], ['scheduledAt', 'ASC']],
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
      });

      // Participants per round, scoped for a TPO to their own students.
      const participants = await RoundParticipant.findAll({
        where: { roundId: { [Op.in]: rounds.map((r) => r.id) }, ...participantWhere },
        include: [
          {
            model: Application,
            as: 'application',
            attributes: ['id', 'studentId', 'status'],
            include: [
              {
                model: User,
                as: 'student',
                attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'],
                include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['studentId', 'branch', 'cgpa'] }]
              }
            ]
          }
        ],
        order: [['slotAt', 'ASC NULLS LAST'], ['id', 'ASC']]
      });

      const byRound = new Map();
      for (const p of participants) {
        if (!byRound.has(p.roundId)) byRound.set(p.roundId, []);
        byRound.get(p.roundId).push(p);
      }

      res.json({
        message: 'Rounds retrieved',
        job: { id: job.id, title: job.title },
        rounds: rounds.map((r) => {
          const list = byRound.get(r.id) || [];
          const counts = list.reduce((acc, p) => ({ ...acc, [p.result]: (acc[p.result] || 0) + 1 }), {});
          return {
            ...r.toJSON(),
            canEdit: canManageRound(req.user, r, job),
            counts: { total: list.length, ...counts },
            participants: list.map((p) => p.toJSON())
          };
        })
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/rounds — schedule a round. */
  async create(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation Error', details: errors.array() });

      const job = await Job.findByPk(req.body.jobId);
      if (!job) return fail(res, 404, 'Job Not Found', 'Job not found');
      if (!canManageJob(req.user, job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot schedule rounds for this job');
      }

      const data = pick(req.body, ROUND_FIELDS);
      if (!data.sequence) {
        const last = await JobRound.max('sequence', { where: { jobId: job.id } });
        data.sequence = (Number(last) || 0) + 1;
      }
      const round = await JobRound.create({
        ...data,
        jobId: job.id,
        // A TPO's round is their campus's; a recruiter's applies everywhere.
        organizationId: req.user.role === 'tpo' ? req.user.organizationId : req.body.organizationId || null,
        createdBy: req.user.id
      });
      audit(req, 'round_created', round.id, { jobId: job.id, ...data });
      res.status(201).json({ message: 'Round scheduled', round });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/rounds/:id — reschedule or edit; participants are told. */
  async update(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation Error', details: errors.array() });

      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot edit this round');
      }

      const before = { scheduledAt: round.scheduledAt, venue: round.venue, meetingLink: round.meetingLink, status: round.status };
      await round.update(pick(req.body, ROUND_FIELDS));

      // Rescheduling a round nobody hears about is how students miss it.
      const moved =
        String(before.scheduledAt) !== String(round.scheduledAt) ||
        before.venue !== round.venue ||
        before.meetingLink !== round.meetingLink ||
        (before.status !== round.status && round.status === 'cancelled');
      if (moved) {
        const participants = await RoundParticipant.findAll({
          where: { roundId: round.id },
          include: [{ model: Application, as: 'application', attributes: ['studentId'] }]
        });
        const title = round.status === 'cancelled' ? `${round.name} cancelled` : `${round.name} rescheduled`;
        const message =
          round.status === 'cancelled'
            ? `${round.name} for ${round.job.title} has been cancelled.`
            : `${round.name} for ${round.job.title} is now ${describeRound(round)}.`;
        await Promise.allSettled(
          participants.map((p) =>
            notificationService.createNotification(p.application.studentId, title, message, 'application_update', {
              roundId: round.id,
              jobId: round.jobId,
              link: '/applications'
            }, 'high')
          )
        );
      }
      audit(req, 'round_updated', round.id, pick(req.body, ROUND_FIELDS));
      res.json({ message: 'Round updated', round });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/rounds/:id */
  async remove(req, res, next) {
    try {
      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot delete this round');
      }
      await round.destroy();
      audit(req, 'round_deleted', round.id, { jobId: round.jobId, name: round.name });
      res.json({ message: 'Round deleted' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rounds/:id/participants
   *
   * Add students to a round by any of:
   *   applicationIds — explicit
   *   identifiers    — pasted roll numbers / emails, as recruiters send them
   *   fromPreviousRound: true — everyone who cleared the round before this one
   *   allApplicants: true — every live application (typical for round 1)
   * Each added student is notified with the round's time and place.
   */
  async addParticipants(req, res, next) {
    try {
      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot change this round');
      }

      const { applicationIds, identifiers, fromPreviousRound, allApplicants, slotAt, panel } = req.body;
      const studentScope = {};
      // A TPO acts for their own students; a campus-specific round only ever
      // holds that campus's students.
      const scopeOrg = req.user.role === 'tpo' ? req.user.organizationId : round.organizationId;
      if (scopeOrg) studentScope.organizationId = scopeOrg;

      const appWhere = { jobId: round.jobId, status: { [Op.notIn]: ['withdrawn', 'rejected'] } };
      const unknown = [];

      if (Array.isArray(applicationIds) && applicationIds.length) {
        appWhere.id = { [Op.in]: applicationIds.map(Number).filter(Boolean) };
      } else if (Array.isArray(identifiers) && identifiers.length) {
        const cleaned = [...new Set(identifiers.map((v) => String(v).trim()).filter(Boolean))];
        const lowered = cleaned.map((v) => v.toLowerCase());
        const users = await User.findAll({
          where: {
            role: 'student',
            ...studentScope,
            [Op.or]: [
              sequelizeWhere(fn('lower', col('User.email')), { [Op.in]: lowered }),
              sequelizeWhere(fn('lower', col('studentProfile.student_id')), { [Op.in]: lowered })
            ]
          },
          include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['studentId'] }],
          attributes: ['id', 'email']
        });
        const known = new Set();
        users.forEach((u) => {
          known.add(u.email.toLowerCase());
          if (u.studentProfile?.studentId) known.add(String(u.studentProfile.studentId).toLowerCase());
        });
        cleaned.forEach((v) => !known.has(v.toLowerCase()) && unknown.push(v));
        appWhere.studentId = { [Op.in]: users.map((u) => u.id) };
      } else if (fromPreviousRound) {
        const previous = await JobRound.findOne({
          where: {
            jobId: round.jobId,
            sequence: { [Op.lt]: round.sequence },
            ...(round.organizationId ? { [Op.or]: [{ organizationId: null }, { organizationId: round.organizationId }] } : {})
          },
          order: [['sequence', 'DESC']]
        });
        if (!previous) return fail(res, 400, 'No Previous Round', 'This is the first round of the drive');
        const cleared = await RoundParticipant.findAll({ where: { roundId: previous.id, result: 'cleared' }, attributes: ['applicationId'] });
        appWhere.id = { [Op.in]: cleared.map((c) => c.applicationId) };
      } else if (!allApplicants) {
        return fail(res, 400, 'Validation Error', 'Say who to add: applicationIds, identifiers, fromPreviousRound or allApplicants');
      }

      const applications = await Application.findAll({
        where: appWhere,
        include: [{ model: User, as: 'student', attributes: ['id', 'organizationId'], where: studentScope }],
        attributes: ['id', 'studentId', 'status']
      });

      const existing = await RoundParticipant.findAll({
        where: { roundId: round.id, applicationId: { [Op.in]: applications.map((a) => a.id) } },
        attributes: ['applicationId']
      });
      const already = new Set(existing.map((e) => e.applicationId));
      const fresh = applications.filter((a) => !already.has(a.id));

      await RoundParticipant.bulkCreate(
        fresh.map((a) => ({ roundId: round.id, applicationId: a.id, slotAt: slotAt || null, panel: panel || null }))
      );

      // Being placed in a round means the student has been shortlisted.
      const toShortlist = fresh.filter((a) => ['applied', 'screening'].includes(a.status)).map((a) => a.id);
      if (toShortlist.length) {
        await Application.update({ status: 'shortlisted', shortlistedAt: new Date() }, { where: { id: { [Op.in]: toShortlist } } });
      }

      await Promise.allSettled(
        fresh.map((a) =>
          notificationService.createNotification(
            a.studentId,
            `You're in: ${round.name}`,
            `You have been shortlisted for ${round.name} of ${round.job.title} — ${describeRound(round)}.`,
            'application_update',
            { roundId: round.id, jobId: round.jobId, applicationId: a.id, link: `/applications/${a.id}` },
            'high'
          )
        )
      );

      audit(req, 'round_participants_added', round.id, { added: fresh.map((a) => a.id) });
      res.json({
        message: `${fresh.length} student(s) added to ${round.name}`,
        added: fresh.length,
        alreadyInRound: already.size,
        unknown
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rounds/:id/results — record results in bulk.
   * Body: { result, participantIds?: [], identifiers?: [], rejectOthers?: bool }
   * `not_cleared` on the final round's leftovers is the usual end of a drive,
   * so the matching applications are moved to rejected when asked.
   */
  async recordResults(req, res, next) {
    try {
      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot change this round');
      }
      const { result, participantIds, identifiers, rejectOthers, remarks } = req.body;
      if (!['pending', 'cleared', 'not_cleared', 'absent'].includes(result)) {
        return fail(res, 400, 'Validation Error', 'result must be pending, cleared, not_cleared or absent');
      }

      const participants = await RoundParticipant.findAll({
        where: { roundId: round.id },
        include: [
          {
            model: Application,
            as: 'application',
            attributes: ['id', 'studentId', 'status'],
            include: [
              {
                model: User,
                as: 'student',
                attributes: ['id', 'email', 'organizationId'],
                include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['studentId'] }]
              }
            ]
          }
        ]
      });
      const inScope = participants.filter(
        (p) => req.user.role !== 'tpo' || p.application?.student?.organizationId === req.user.organizationId
      );

      let targets = [];
      if (Array.isArray(participantIds) && participantIds.length) {
        const ids = new Set(participantIds.map(Number));
        targets = inScope.filter((p) => ids.has(p.id));
      } else if (Array.isArray(identifiers) && identifiers.length) {
        const wanted = new Set(identifiers.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
        targets = inScope.filter(
          (p) =>
            wanted.has(String(p.application?.student?.email || '').toLowerCase()) ||
            wanted.has(String(p.application?.student?.studentProfile?.studentId || '').toLowerCase())
        );
      } else {
        return fail(res, 400, 'Validation Error', 'Provide participantIds or identifiers');
      }

      await RoundParticipant.update(
        { result, ...(remarks !== undefined ? { remarks } : {}) },
        { where: { id: { [Op.in]: targets.map((t) => t.id) } } }
      );

      let others = [];
      if (rejectOthers) {
        const chosen = new Set(targets.map((t) => t.id));
        others = inScope.filter((p) => !chosen.has(p.id) && p.result === 'pending');
        if (others.length) {
          await RoundParticipant.update({ result: 'not_cleared' }, { where: { id: { [Op.in]: others.map((o) => o.id) } } });
        }
      }

      const rejectedApps = [
        ...(result === 'not_cleared' ? targets : []),
        ...others
      ]
        .map((p) => p.application)
        .filter((a) => a && !['withdrawn', 'selected'].includes(a.status));
      if (rejectedApps.length) {
        await Application.update(
          { status: 'rejected', resultAt: new Date() },
          { where: { id: { [Op.in]: rejectedApps.map((a) => a.id) } } }
        );
      }
      const clearedApps = result === 'cleared' ? targets.map((t) => t.application).filter(Boolean) : [];
      if (clearedApps.length && ['technical', 'hr', 'group_discussion'].includes(round.roundType)) {
        await Application.update(
          { status: 'interviewed', interviewedAt: new Date() },
          { where: { id: { [Op.in]: clearedApps.map((a) => a.id) }, status: { [Op.in]: ['applied', 'screening', 'shortlisted'] } } }
        );
      }

      const label = { cleared: 'cleared', not_cleared: 'did not clear', absent: 'was marked absent for', pending: 'is pending in' };
      await Promise.allSettled(
        [...targets.map((t) => [t, result]), ...others.map((o) => [o, 'not_cleared'])]
          .filter(([, r]) => r !== 'pending')
          .map(([p, r]) =>
            notificationService.createNotification(
              p.application.studentId,
              `${round.name}: result`,
              `You ${label[r]} ${round.name} of ${round.job.title}.`,
              'application_update',
              { roundId: round.id, jobId: round.jobId, applicationId: p.applicationId, link: `/applications/${p.applicationId}` }
            )
          )
      );

      audit(req, 'round_results_recorded', round.id, { result, updated: targets.length, rejectedOthers: others.length });
      res.json({ message: `${targets.length} result(s) recorded`, updated: targets.length, markedNotCleared: others.length });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/rounds/:id/participants/:participantId — slot, panel, result, remarks for one student. */
  async updateParticipant(req, res, next) {
    try {
      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot change this round');
      }
      const participant = await RoundParticipant.findOne({
        where: { id: req.params.participantId, roundId: round.id },
        include: [{ model: Application, as: 'application', include: [{ model: User, as: 'student', attributes: ['organizationId'] }] }]
      });
      if (!participant) return fail(res, 404, 'Not Found', 'This student is not in the round');
      if (req.user.role === 'tpo' && participant.application?.student?.organizationId !== req.user.organizationId) {
        return fail(res, 404, 'Not Found', 'This student is not in the round');
      }
      const data = pick(req.body, ['slotAt', 'panel', 'result', 'remarks']);
      await participant.update(data);
      if (data.slotAt) {
        notificationService
          .createNotification(
            participant.application.studentId,
            `${round.name}: your slot`,
            `Your slot for ${round.name} of ${round.job.title} is ${new Date(data.slotAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata'
            })}${data.panel || participant.panel ? `, panel ${data.panel || participant.panel}` : ''}.`,
            'application_update',
            { roundId: round.id, applicationId: participant.applicationId, link: `/applications/${participant.applicationId}` },
            'high'
          )
          .catch((err) => logger.error('Slot notification failed', err));
      }
      res.json({ message: 'Participant updated', participant });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/rounds/:id/participants/:participantId */
  async removeParticipant(req, res, next) {
    try {
      const round = await JobRound.findByPk(req.params.id, { include: [{ model: Job, as: 'job' }] });
      if (!round) return fail(res, 404, 'Round Not Found', 'Round not found');
      if (!canManageRound(req.user, round, round.job)) {
        return fail(res, 403, 'Access Forbidden', 'You cannot change this round');
      }
      const participant = await RoundParticipant.findOne({
        where: { id: req.params.participantId, roundId: round.id },
        include: [{ model: Application, as: 'application', include: [{ model: User, as: 'student', attributes: ['organizationId'] }] }]
      });
      if (!participant || (req.user.role === 'tpo' && participant.application?.student?.organizationId !== req.user.organizationId)) {
        return fail(res, 404, 'Not Found', 'This student is not in the round');
      }
      await participant.destroy();
      res.json({ message: 'Removed from round' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rounds/mine — a student's rounds across all applications, or
   * ?applicationId= for one. Includes rounds of their jobs they are not (yet)
   * in, so the student sees the whole process, not only the steps they reached.
   */
  async mine(req, res, next) {
    try {
      const appWhere = { studentId: req.user.id };
      if (req.query.applicationId) appWhere.id = parseInt(req.query.applicationId, 10) || -1;
      const applications = await Application.findAll({
        where: appWhere,
        attributes: ['id', 'jobId', 'status'],
        include: [{ model: Job, as: 'job', attributes: ['id', 'title'], include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'logoUrl'] }] }]
      });
      if (!applications.length) return res.json({ message: 'Rounds retrieved', rounds: [] });

      const rounds = await JobRound.findAll({
        where: {
          jobId: { [Op.in]: applications.map((a) => a.jobId) },
          [Op.or]: [{ organizationId: null }, { organizationId: req.user.organizationId || -1 }]
        },
        order: [['scheduledAt', 'ASC NULLS LAST'], ['sequence', 'ASC']]
      });
      const mine = await RoundParticipant.findAll({
        where: { applicationId: { [Op.in]: applications.map((a) => a.id) } }
      });
      const byRound = new Map(mine.map((p) => [p.roundId, p]));
      const appByJob = new Map(applications.map((a) => [a.jobId, a]));

      res.json({
        message: 'Rounds retrieved',
        rounds: rounds.map((r) => {
          const app = appByJob.get(r.jobId);
          const p = byRound.get(r.id);
          return {
            id: r.id,
            name: r.name,
            roundType: r.roundType,
            sequence: r.sequence,
            scheduledAt: r.scheduledAt,
            endsAt: r.endsAt,
            mode: r.mode,
            status: r.status,
            // Venue and link only once the student is actually in the round.
            venue: p ? r.venue : null,
            meetingLink: p ? r.meetingLink : null,
            instructions: p ? r.instructions : null,
            job: app?.job,
            applicationId: app?.id,
            participation: p ? { id: p.id, slotAt: p.slotAt, panel: p.panel, result: p.result } : null
          };
        })
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoundController();
