// client/src/services/school.js
//
// The data layer behind the five school-side dashboards (student, principal,
// teacher, school admin, career counsellor).
//
// It exists because those five screens draw on the same small set of endpoints
// and share two non-obvious server behaviours that must be handled identically
// everywhere, or the dashboards will disagree with each other:
//
//   1. `GET /api/events` reports an inflated `pagination.totalEvents`. The
//      controller's `findAndCountAll` includes the `registrations` association
//      without `distinct: true`, so the count is rows-after-join, not events:
//      `?eventType=workshop` returns 2 events but reports 3. Never render that
//      number — the dashboards ask for a page big enough to hold the whole
//      result and count the returned array instead.
//
//   2. `GET /api/events` always returns `userRegistration: null`. The
//      controller looks up `reg.userId` on registrations it selected with
//      `attributes: ['id', 'status']`, so the field it matches on is never
//      loaded. The list therefore cannot say whether you are registered.
//      `withMyRegistration` recovers it from `GET /api/events/:id`, which does
//      return full registration rows.
//
// Every read passes `silent: true`: these pages render their own ErrorState,
// and the shared interceptor in `services/api.js` would otherwise also toast,
// giving the user two notices for one failure.
import api from './api';

/** Events list. `params` maps straight onto the documented query string. */
export const listEvents = (params = {}) => api.get('/events', { params, silent: true });

export const getEvent = (id) => api.get(`/events/${id}`, { silent: true });

/** These two are user-initiated, so their errors are surfaced by the caller. */
export const registerForEvent = (id) => api.post(`/events/${id}/register`);
export const cancelEventRegistration = (id) => api.post(`/events/${id}/cancel`);

export const listAssessments = (params = {}) =>
  api.get('/assessments', { params, silent: true });

export const takeAssessment = (id) => api.post(`/assessments/${id}/take`);
export const submitAssessment = (id, payload) => api.post(`/assessments/${id}/submit`, payload);

export const listConferences = (params = {}) =>
  api.get('/conferences', { params, silent: true });

/** Only the `userId` filter exists server-side; there is no organisation scope. */
export const listAchievements = (params = {}) =>
  api.get('/achievements', { params, silent: true });

export const getOrganization = (id) => api.get(`/organizations/${id}`, { silent: true });

/* ------------------------------------------------------------------ helpers */

const isFuture = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= Date.now();
};

/** An event is "upcoming" when it has not started and has not been cancelled. */
export const isUpcomingEvent = (event) =>
  event?.status !== 'cancelled' && event?.status !== 'completed' && isFuture(event?.startTime);

/**
 * True when the event still accepts registrations.
 *
 * Mirrors `registerForEvent` exactly, including its `status !== 'scheduled'`
 * gate — an `ongoing` event is rejected server-side, so offering a Register
 * button for one would be a button that can only fail.
 */
export const registrationOpen = (event) => {
  if (event?.status !== 'scheduled') return false;
  if (!isFuture(event?.startTime)) return false;
  if (!event.registrationDeadline) return true;
  return isFuture(event.registrationDeadline);
};

/**
 * Annotates each event with `myRegistration`, the caller's own registration row.
 *
 * A cancelled row is kept rather than discarded, because the server treats it
 * as blocking: `registerForEvent` 409s on *any* existing row for the pair, so
 * once you cancel you can never sign up again. Hiding the cancelled row would
 * show a Register button that is guaranteed to fail.
 *
 * One extra request per event, so callers must pass a short list — the
 * dashboards enrich only the handful of events they actually display. Uses
 * `allSettled` so one failed detail fetch degrades that card to "unknown"
 * rather than blanking the panel.
 */
export const withMyRegistration = async (events, userId) => {
  if (!userId || !events?.length) return events || [];
  const details = await Promise.allSettled(events.map((e) => getEvent(e.id)));
  return events.map((event, i) => {
    const settled = details[i];
    if (settled.status !== 'fulfilled') return { ...event, myRegistration: undefined };
    const rows = settled.value?.event?.registrations || [];
    const mine = rows.find((r) => r.userId === userId);
    return { ...event, myRegistration: mine || null };
  });
};

/** Human-readable event window. Returns null when there is no usable date. */
export const formatEventWhen = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const EVENT_TYPE_LABELS = {
  campus_drive: 'Campus drive',
  info_session: 'Info session',
  workshop: 'Workshop',
  seminar: 'Seminar',
  job_fair: 'Job fair',
  other: 'Other'
};

/** Normalises an axios failure into the shape ErrorState wants. */
export const toErrorState = (err, title) => ({
  title,
  description:
    err?.response?.data?.message ||
    err?.message ||
    'The server did not respond as expected. Try again.'
});
