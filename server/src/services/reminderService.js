// server/src/services/reminderService.js
//
// Deadlines were stored but nothing ever watched the clock.
//
// `jobs.application_deadline` and `events.start_time` have always been on the
// records, and there is a working notification service — but nothing connected
// the two, so a student who did not happen to open the site on the right day
// simply missed the drive. That is the failure mode that destroys trust in a
// placement portal fastest, and it is the one thing a portal can prevent that
// a WhatsApp group cannot.
//
// Two sweeps run on a timer:
//
//   * job deadlines — every eligible student who has not applied yet
//   * event start times — everyone actually registered for the event
//
// Both are idempotent. Rather than adding a "reminder sent" table, each sweep
// checks for a notification it has already written for that user and that
// entity, so restarting the process (or running two of them) cannot double-send.
// The metadata carries `reminderKind` and the entity id, which is what makes
// that check possible.

const { Op } = require('sequelize');
const {
  Job,
  Event,
  EventRegistration,
  Application,
  User,
  StudentProfile,
  Notification,
  Organization
} = require('../models');
const notificationService = require('./notificationService');
const { checkEligibility } = require('../utils/eligibility');
const logger = require('../utils/logger');

// Events carry a real timestamp, so they get the two-hour warning Superset
// defaults to, plus a day's notice — which is what makes the two-hour one
// useful, because by then a student can still act on it.
// Ordered tightest-first, which is what the suppression below relies on: an
// event two hours away also falls inside the 24-hour window, and firing both
// would send a student two notifications about one event in the same sweep.
const EVENT_WINDOWS = [
  { hours: 2, label: 'in 2 hours' },
  { hours: 24, label: 'in 24 hours' }
];

// `jobs.application_deadline` is a DATEONLY column — a calendar date with no
// time of day — so an hours-based warning is not expressible against it: every
// deadline reads as midnight. Job reminders are therefore counted in whole
// days, which is the real resolution of the data. Giving the column a time
// component would allow a T-2h job reminder too, but that is a migration and a
// change to the posting form, not a scheduling decision.
// Also tightest-first. A job cannot match two day-targets at once, but keeping
// the order consistent means the same suppression rule reads the same way in
// both sweeps.
const JOB_WINDOWS = [
  { days: 0, label: 'today' },
  { days: 1, label: 'tomorrow' },
  { days: 3, label: 'in 3 days' }
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A DATEONLY value as a plain YYYY-MM-DD string, whatever the driver returns. */
const dayString = (value) =>
  typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);

/**
 * Load every reminder already sent, as a set of keys.
 *
 * Deliberately not a `metadata @> {...}` query: `notifications.metadata` is a
 * `json` column, and Postgres only implements the containment operator for
 * `jsonb`, so that query is a runtime error rather than a slow path. Reading
 * the reminder notifications once per sweep and matching in memory also
 * collapses what would otherwise be one query per student per job.
 */
const loadSentKeys = async () => {
  const rows = await Notification.findAll({
    where: { notificationType: { [Op.in]: ['job_alert', 'event_reminder'] } },
    attributes: ['userId', 'metadata']
  });
  const keys = new Set();
  for (const row of rows) {
    const m = row.metadata || {};
    if (!m.reminderKind) continue;
    keys.add(`${row.userId}:${m.reminderKind}:${m.entityId}:${m.windowHours}`);

    // Reconstruct the wider-window suppression from what was stored. A student
    // already told an event starts in 2 hours must not be told on the next
    // sweep that it starts in 24 — the suppression has to survive a restart,
    // so it is derived here rather than held only for the length of one run.
    if (m.reminderKind === 'event_start') {
      const sentHours = Number(m.windowHours);
      for (const w of EVENT_WINDOWS) {
        if (w.hours >= sentHours) {
          keys.add(`${row.userId}:event_start:${m.entityId}:${w.hours}`);
        }
      }
    }
    if (m.reminderKind === 'job_deadline') {
      const sentDays = parseInt(String(m.windowHours), 10);
      for (const w of JOB_WINDOWS) {
        if (Number.isFinite(sentDays) && w.days >= sentDays) {
          keys.add(`${row.userId}:job_deadline:${m.entityId}:${w.days}d`);
        }
      }
    }
  }
  return keys;
};

const keyFor = (userId, kind, entityId, windowHours) =>
  `${userId}:${kind}:${entityId}:${windowHours}`;

/**
 * Remind eligible students about a job whose deadline is close.
 *
 * Only students who have *not* applied are reminded — a reminder to someone who
 * already applied is noise, and noise is how notifications get ignored. The
 * same eligibility rules the apply endpoint enforces are applied here, so we
 * never tell a student to hurry up and apply for something they would be
 * refused.
 */
const sweepJobDeadlines = async (now = new Date(), sentKeys = null) => {
  const sent0 = sentKeys || (await loadSentKeys());
  let sent = 0;

  for (const window of JOB_WINDOWS) {
    // Compare dates to dates. The column holds no time, so the target is the
    // single calendar day `window.days` from now.
    const target = dayString(new Date(now.getTime() + window.days * DAY));

    const jobs = await Job.findAll({
      where: { status: 'active', applicationDeadline: target },
      include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
    });

    for (const job of jobs) {
      const applied = await Application.findAll({
        where: { jobId: job.id },
        attributes: ['studentId']
      });
      const appliedIds = applied.map((a) => a.studentId);

      // A student with no profile cannot be checked for eligibility and has
      // nothing to apply with, so requiring the profile is deliberate.
      const students = await User.findAll({
        where: {
          role: 'student',
          isActive: true,
          ...(appliedIds.length ? { id: { [Op.notIn]: appliedIds } } : {})
        },
        include: [
          { model: StudentProfile, as: 'studentProfile', required: true },
          {
            model: Organization,
            as: 'organization',
            required: true,
            // School pupils are not candidates for graduate roles.
            where: { type: { [Op.ne]: 'school' } },
            attributes: ['id']
          }
        ],
        attributes: ['id']
      });

      for (const student of students) {
        const { eligible } = checkEligibility(job.eligibilityCriteria, student.studentProfile);
        if (!eligible) continue;
        const key = keyFor(student.id, 'job_deadline', job.id, `${window.days}d`);
        if (sent0.has(key)) continue;
        // Claim every wider window as well. Once a student has been told the
        // deadline is today, a later "in 3 days" reminder would be nonsense.
        for (const w of JOB_WINDOWS) {
          sent0.add(keyFor(student.id, 'job_deadline', job.id, `${w.days}d`));
        }

        await notificationService.createNotification(
          student.id,
          'Application deadline approaching',
          `Applications for ${job.title} at ${job.organization?.name || 'this company'} close ${window.label}.`,
          'job_alert',
          { reminderKind: 'job_deadline', entityId: job.id, windowHours: `${window.days}d`, jobId: job.id },
          window.days === 0 ? 'urgent' : 'high'
        );
        sent += 1;
      }
    }
  }

  return sent;
};

/** Remind registered attendees that an event starts soon. */
const sweepEventStarts = async (now = new Date(), sentKeys = null) => {
  const sent0 = sentKeys || (await loadSentKeys());
  let sent = 0;

  for (const window of EVENT_WINDOWS) {
    const from = new Date(now.getTime());
    const to = new Date(now.getTime() + window.hours * HOUR);

    const events = await Event.findAll({
      where: {
        status: 'scheduled',
        startTime: { [Op.gt]: from, [Op.lte]: to }
      }
    });

    for (const event of events) {
      const registrations = await EventRegistration.findAll({
        // A cancelled registration is not an attendee.
        where: { eventId: event.id, status: { [Op.ne]: 'cancelled' } },
        attributes: ['userId']
      });

      for (const registration of registrations) {
        const key = keyFor(registration.userId, 'event_start', event.id, window.hours);
        if (sent0.has(key)) continue;
        // An event two hours out is inside the 24-hour window too. Claim the
        // wider ones so only the most urgent message is sent.
        for (const w of EVENT_WINDOWS) {
          if (w.hours >= window.hours) {
            sent0.add(keyFor(registration.userId, 'event_start', event.id, w.hours));
          }
        }

        await notificationService.createNotification(
          registration.userId,
          'Event starting soon',
          `${event.title} starts ${window.label}${event.location ? ` at ${event.location}` : ''}.`,
          'event_reminder',
          { reminderKind: 'event_start', entityId: event.id, windowHours: window.hours, eventId: event.id },
          window.hours <= 2 ? 'urgent' : 'high'
        );
        sent += 1;
      }
    }
  }

  return sent;
};

/** Run both sweeps. Never throws — a failed sweep must not take the process down. */
const runOnce = async (now = new Date()) => {
  try {
    // One read of the already-sent set, shared by both sweeps.
    const sentKeys = await loadSentKeys();
    const jobs = await sweepJobDeadlines(now, sentKeys);
    const events = await sweepEventStarts(now, sentKeys);
    if (jobs || events) {
      logger.info('Reminder sweep sent notifications', { jobDeadlines: jobs, eventStarts: events });
    }
    return { jobs, events };
  } catch (error) {
    logger.error('Reminder sweep failed', error);
    return { jobs: 0, events: 0, error: error.message };
  }
};

let timer = null;

/**
 * Start the timer.
 *
 * A plain interval rather than a cron dependency: the sweeps are idempotent and
 * look at a window rather than an instant, so exact firing times do not matter
 * and a missed tick is picked up by the next one. `REMINDER_SWEEP_MINUTES=0`
 * disables it, which is what the test environment wants.
 */
const start = () => {
  const minutes = Number(process.env.REMINDER_SWEEP_MINUTES ?? 15);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    logger.info('Reminder sweeps disabled');
    return null;
  }
  if (timer) return timer;

  timer = setInterval(() => { runOnce(); }, minutes * 60 * 1000);
  // Do not hold the event loop open on a process that is otherwise done.
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('Reminder sweeps scheduled', { everyMinutes: minutes });
  return timer;
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { runOnce, sweepJobDeadlines, sweepEventStarts, start, stop };
