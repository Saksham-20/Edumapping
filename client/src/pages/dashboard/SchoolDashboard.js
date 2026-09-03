// client/src/pages/dashboard/SchoolDashboard.js
//
// The landing screen for a student at a school-type organization.
//
// Replaces a static placeholder that faked a spinner and rendered four tabs of
// invented content. Everything here now comes from an endpoint the `student`
// role is actually permitted to call, verified against the running API:
//
//   GET  /api/events                 — what is on, filtered by type
//   GET  /api/events/:id             — the only source of "am I registered"
//   POST /api/events/:id/register    — and /cancel
//   GET  /api/assessments            — a real backend feature with no UI until now
//   POST /api/assessments/:id/take   — and /submit
//   GET  /api/conferences            — live classes
//   GET  /api/achievements?userId=   — the student's own record
//
// The old "Co-Curricular" tab is gone: `eventType` has no such value, so it
// could never have been anything but decoration.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  cancelEventRegistration,
  formatEventWhen,
  isUpcomingEvent,
  listAchievements,
  listAssessments,
  listConferences,
  listEvents,
  registerForEvent,
  registrationOpen,
  submitAssessment,
  takeAssessment,
  toErrorState,
  withMyRegistration
} from '../../services/school';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  PageShell,
  SectionBlock,
  SkeletonCard,
  StatTile,
  Tabs
} from '../../components/ui';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  MapPinIcon,
  SignalIcon,
  TrophyIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'events', label: 'Events', icon: CalendarIcon },
  { value: 'assessments', label: 'Assessments', icon: ClipboardDocumentCheckIcon },
  { value: 'live', label: 'Live classes', icon: VideoCameraIcon },
  { value: 'achievements', label: 'Achievements', icon: TrophyIcon }
];

/* ------------------------------------------------------------------- events */

const EventCard = ({ event, busy, onRegister, onCancel }) => {
  const when = formatEventWhen(event.startTime);
  const registered = event.myRegistration?.status === 'registered';
  // The server refuses a second registration even after a cancellation, so a
  // cancelled row is a dead end, not an invitation to sign up again.
  const cancelled = event.myRegistration?.status === 'cancelled';
  const canRegister = !cancelled && registrationOpen(event);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink-950">{event.title}</h3>
          <p className="mt-1 text-xs text-ink-600">
            {event.organization?.name || 'Unknown organizer'}
          </p>
        </div>
        <Badge tone="neutral">{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</Badge>
      </div>

      {event.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600">{event.description}</p>
      )}

      <dl className="mt-3 space-y-1.5 text-xs text-ink-500">
        {when && (
          <div className="flex items-center gap-1.5">
            <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <dt className="sr-only">Starts</dt>
            <dd>{when}</dd>
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPinIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <dt className="sr-only">Location</dt>
            <dd className="truncate">{event.location}</dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <dt>Registered</dt>
          <dd className="tabular-nums">
            {event.registrationCount}
            {event.maxParticipants ? ` of ${event.maxParticipants}` : ''}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {registered ? (
          <>
            <Badge tone="success" dot>
              You are registered
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => onCancel(event)}
            >
              Cancel registration
            </Button>
          </>
        ) : cancelled ? (
          <Badge tone="neutral" dot>
            You cancelled — this event cannot be rejoined
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="saffron"
            loading={busy}
            disabled={!canRegister}
            onClick={() => onRegister(event)}
          >
            {canRegister ? 'Register' : 'Registration closed'}
          </Button>
        )}
        <Button as={Link} to={`/events/${event.id}`} size="sm" variant="ghost">
          Details
        </Button>
      </div>
    </Card>
  );
};

/* -------------------------------------------------------------- assessments */

/**
 * The assessment runner.
 *
 * `POST /take` is what hands over the questions, and it is one-shot — the
 * server 409s on a second call — so the modal only opens once the take request
 * has succeeded, and the questions it renders are the ones that request
 * returned. There is no endpoint that lists a student's past results, so a
 * score is shown only for an attempt made in this session.
 */
const AssessmentRunner = ({ open, assessment, onClose, onSubmitted }) => {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const questions = assessment?.questions || [];

  useEffect(() => {
    if (open) setAnswers({});
  }, [open, assessment?.id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      // The server scores positionally, so the payload must be a dense array
      // in question order — an object keyed by question id would score zero.
      const ordered = questions.map((_, i) => (answers[i] === undefined ? null : answers[i]));
      const data = await submitAssessment(assessment.id, {
        answers: ordered,
        timeSpent: 0
      });
      onSubmitted(assessment.id, data.result);
      toast.success('Assessment submitted');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit the assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={assessment?.title || 'Assessment'}
      description={
        assessment?.duration ? `Suggested time: ${assessment.duration} minutes.` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={submitting} onClick={submit}>
            Submit answers
          </Button>
        </>
      }
    >
      {assessment?.instructions && (
        <p className="mb-5 rounded-xl border border-ink-950/15 bg-bone-100 px-4 py-3 text-sm text-ink-700">
          {assessment.instructions}
        </p>
      )}
      <ol className="space-y-6">
        {questions.map((q, i) => (
          <li key={q.id ?? i}>
            <p className="text-sm font-semibold text-ink-950">
              {i + 1}. {q.question}
              {q.marks ? (
                <span className="ml-2 font-normal text-ink-500">({q.marks} marks)</span>
              ) : null}
            </p>
            {Array.isArray(q.options) && q.options.length > 0 ? (
              <fieldset className="mt-2.5 space-y-2">
                <legend className="sr-only">{q.question}</legend>
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-950/15 bg-white px-3.5 py-2.5 text-sm text-ink-800 hover:border-ink-950/40"
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      className="mt-0.5 text-saffron-500 focus:ring-ink-950"
                      checked={answers[i] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <textarea
                rows={4}
                aria-label={`Answer to question ${i + 1}`}
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                className="mt-2.5 w-full rounded-xl border border-ink-950/20 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-ink-950 focus:outline-none focus:ring-1 focus:ring-ink-950"
              />
            )}
          </li>
        ))}
      </ol>
    </Modal>
  );
};

/* -------------------------------------------------------------------- page */

const SchoolDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('events');

  const [events, setEvents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const [busyEventId, setBusyEventId] = useState(null);
  const [runner, setRunner] = useState(null);
  const [results, setResults] = useState({});
  const [startingId, setStartingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    // One dead endpoint must not blank the other three panels, so each request
    // settles on its own and records its own error.
    const [eventsRes, assessmentsRes, conferencesRes, achievementsRes] = await Promise.allSettled([
      listEvents({ limit: 100 }),
      listAssessments(),
      listConferences(),
      listAchievements({ userId: user?.id })
    ]);

    const nextErrors = {};

    if (eventsRes.status === 'fulfilled') {
      const upcoming = (eventsRes.value.events || [])
        .filter(isUpcomingEvent)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      // Enrich only the cards actually rendered: registration state costs one
      // request per event, so it is bounded here rather than across all 100.
      const shown = upcoming.slice(0, 9);
      setEvents(await withMyRegistration(shown, user?.id));
    } else {
      nextErrors.events = toErrorState(eventsRes.reason, 'Could not load events');
    }

    if (assessmentsRes.status === 'fulfilled') {
      setAssessments((assessmentsRes.value.assessments || []).filter((a) => a.isActive !== false));
    } else {
      nextErrors.assessments = toErrorState(assessmentsRes.reason, 'Could not load assessments');
    }

    if (conferencesRes.status === 'fulfilled') {
      setConferences(conferencesRes.value.conferences || []);
    } else {
      nextErrors.live =
        conferencesRes.reason?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description: 'This server has no LiveKit connection configured.'
            }
          : toErrorState(conferencesRes.reason, 'Could not load live classes');
    }

    if (achievementsRes.status === 'fulfilled') {
      setAchievements(achievementsRes.value.achievements || []);
    } else {
      nextErrors.achievements = toErrorState(achievementsRes.reason, 'Could not load achievements');
    }

    setErrors(nextErrors);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const liveClasses = useMemo(
    () => conferences.filter((c) => c.status !== 'ended'),
    [conferences]
  );
  const registeredCount = useMemo(
    () => events.filter((e) => e.myRegistration?.status === 'registered').length,
    [events]
  );

  const onRegister = async (event) => {
    setBusyEventId(event.id);
    try {
      await registerForEvent(event.id);
      toast.success(`Registered for ${event.title}`);
      // Re-read from the server rather than guessing the new count locally.
      setEvents(await withMyRegistration(events, user?.id));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not register for this event');
    } finally {
      setBusyEventId(null);
    }
  };

  const onCancel = async (event) => {
    setBusyEventId(event.id);
    try {
      await cancelEventRegistration(event.id);
      toast.success('Registration cancelled');
      setEvents(await withMyRegistration(events, user?.id));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel the registration');
    } finally {
      setBusyEventId(null);
    }
  };

  const onStart = async (assessment) => {
    setStartingId(assessment.id);
    try {
      const data = await takeAssessment(assessment.id);
      setRunner(data.assessment);
    } catch (err) {
      // 409 is the server saying this student has already attempted it. That is
      // information, not a failure — and it is the only way to learn it, since
      // no endpoint lists past attempts.
      if (err?.response?.status === 409) {
        setResults((r) => ({ ...r, [assessment.id]: { alreadyTaken: true } }));
        toast('You have already taken this assessment', { icon: '✓' });
      } else {
        toast.error(err?.response?.data?.message || 'Could not start the assessment');
      }
    } finally {
      setStartingId(null);
    }
  };

  const eventsPanel = () => {
    if (errors.events) {
      return <ErrorState {...errors.events} onRetry={load} />;
    }
    if (!events.length) {
      return (
        <EmptyState
          icon={CalendarIcon}
          title="Nothing scheduled yet"
          description="When your school or a visiting organization schedules a workshop, seminar or drive, it will appear here."
          action={
            <Button as={Link} to="/events" variant="secondary">
              Browse all events
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            busy={busyEventId === e.id}
            onRegister={onRegister}
            onCancel={onCancel}
          />
        ))}
      </div>
    );
  };

  const assessmentsPanel = () => {
    if (errors.assessments) {
      return <ErrorState {...errors.assessments} onRetry={load} />;
    }
    if (!assessments.length) {
      return (
        <EmptyState
          icon={ClipboardDocumentCheckIcon}
          title="No assessments published"
          description="Assessments set by recruiters and placement officers show up here as soon as they are published."
        />
      );
    }
    return (
      <>
        <p className="mb-4 rounded-xl border border-ink-950/15 bg-bone-100 px-4 py-3 text-sm text-ink-700">
          Each assessment can be attempted once. Scores from earlier sessions are
          not shown — the API has no endpoint that lists past attempts yet.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {assessments.map((a) => {
            const result = results[a.id];
            return (
              <Card key={a.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-ink-950">{a.title}</h3>
                  <Badge tone="neutral">{String(a.assessmentType || '').replace(/_/g, ' ')}</Badge>
                </div>
                {a.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-600">{a.description}</p>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-ink-600">
                  <div>
                    <dt className="text-ink-500">Duration</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {a.duration ? `${a.duration} min` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Questions</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {(a.questions || []).length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Pass mark</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {a.passingMarks ?? '—'}
                      {a.totalMarks ? ` / ${a.totalMarks}` : ''}
                    </dd>
                  </div>
                </dl>
                {a.job?.title && (
                  <p className="mt-3 text-xs text-ink-500">Linked to {a.job.title}</p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {result?.alreadyTaken || result?.percentage !== undefined ? (
                    <Badge tone={result?.passed ? 'success' : 'neutral'} dot>
                      {result?.percentage !== undefined
                        ? `Scored ${result.score} (${Math.round(result.percentage)}%)`
                        : 'Already attempted'}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="saffron"
                      loading={startingId === a.id}
                      onClick={() => onStart(a)}
                    >
                      Start assessment
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  const livePanel = () => {
    if (errors.live) {
      return <ErrorState {...errors.live} onRetry={load} />;
    }
    if (!liveClasses.length) {
      return (
        <EmptyState
          icon={VideoCameraIcon}
          title="No live classes scheduled"
          description="Sessions your teachers schedule will appear here, and you can join them from this page."
          action={
            <Button as={Link} to="/conferences" variant="secondary">
              Open live classes
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveClasses.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-950">{c.title}</h3>
              <Badge tone={c.status === 'live' ? 'danger' : 'info'} dot>
                {c.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-600">
              {c.host ? `${c.host.firstName} ${c.host.lastName}` : 'Unknown host'}
            </p>
            {c.scheduledStart && (
              <p className="mt-3 text-xs text-ink-500">{formatEventWhen(c.scheduledStart)}</p>
            )}
            <div className="mt-5">
              <Button
                as={Link}
                to={`/conference/${c.id}`}
                size="sm"
                variant={c.status === 'live' ? 'saffron' : 'secondary'}
                icon={c.status === 'live' ? SignalIcon : VideoCameraIcon}
              >
                {c.status === 'live' ? 'Join now' : 'Open room'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const achievementsPanel = () => {
    if (errors.achievements) {
      return <ErrorState {...errors.achievements} onRetry={load} />;
    }
    if (!achievements.length) {
      return (
        <EmptyState
          icon={TrophyIcon}
          title="No achievements recorded"
          description="Competitions, certifications and academic awards added to your record will be listed here."
          action={
            <Button as={Link} to="/profile" variant="secondary">
              Go to your profile
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {achievements.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-950">{a.title}</h3>
              {a.isVerified && (
                <Badge tone="success" dot>
                  Verified
                </Badge>
              )}
            </div>
            {a.description && <p className="mt-2 text-sm text-ink-600">{a.description}</p>}
            <p className="mt-3 text-xs text-ink-500">
              {a.issuingOrganization}
              {a.issueDate ? ` · ${new Date(a.issueDate).toLocaleDateString()}` : ''}
            </p>
          </Card>
        ))}
      </div>
    );
  };

  const panels = {
    events: eventsPanel,
    assessments: assessmentsPanel,
    live: livePanel,
    achievements: achievementsPanel
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow={user?.organization?.name || 'School'}
        title={`Welcome back, ${user?.firstName || 'student'}`}
        lead="Everything your school has scheduled for you, in one place."
        actions={
          <Button as={Link} to="/events" variant="secondary" icon={CalendarIcon}>
            All events
          </Button>
        }
      />

      <SectionBlock>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Upcoming events"
            value={errors.events ? '—' : events.length}
            icon={CalendarIcon}
            loading={loading}
            hint="Next nine, soonest first"
          />
          <StatTile
            label="You are registered"
            value={errors.events ? '—' : registeredCount}
            icon={CheckCircleIcon}
            accent="india"
            loading={loading}
            hint="Among the events shown"
          />
          <StatTile
            label="Assessments open"
            value={errors.assessments ? '—' : assessments.length}
            icon={ClipboardDocumentCheckIcon}
            accent="saffron"
            loading={loading}
          />
          <StatTile
            label="Live classes"
            value={errors.live ? '—' : liveClasses.length}
            icon={VideoCameraIcon}
            accent="azure"
            loading={loading}
            to="/conferences"
          />
        </div>
      </SectionBlock>

      <Tabs className="mb-6 w-fit" value={tab} onChange={setTab} tabs={TABS} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        panels[tab]()
      )}

      <AssessmentRunner
        open={!!runner}
        assessment={runner}
        onClose={() => setRunner(null)}
        onSubmitted={(id, result) => setResults((r) => ({ ...r, [id]: result }))}
      />
    </PageShell>
  );
};

export default SchoolDashboard;
