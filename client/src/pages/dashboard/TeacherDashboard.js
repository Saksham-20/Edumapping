// client/src/pages/dashboard/TeacherDashboard.js
//
// A teacher's home screen. Built on the three endpoints the `teacher` role is
// actually permitted to call, verified against the running API:
//
//   GET /api/conferences   — live classes, split into "mine" and "my school's"
//   GET /api/events        — school events, scoped with organizationId
//   GET /api/assessments   — every published assessment
//
// Two things a teacher screen would obviously want are deliberately absent
// rather than faked:
//
//   * A class roster. `GET /api/users` is `requireRole('admin', 'tpo')`, so a
//     teacher gets a 403. There is no per-organization user listing any role
//     below TPO can call.
//   * "Assessments I set". `POST /api/assessments` is
//     `requireRole('recruiter', 'tpo', 'admin')` — a teacher cannot create one,
//     and `GET /api/assessments` has no `createdBy` filter. So the panel shows
//     the published assessments a teacher can reference, and says so.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  formatEventWhen,
  isUpcomingEvent,
  listAssessments,
  listConferences,
  listEvents,
  toErrorState
} from '../../services/school';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  SectionBlock,
  SkeletonCard,
  StatTile,
  Tabs
} from '../../components/ui';
import {
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  SignalIcon,
  UserGroupIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'live', label: 'Live classes', icon: VideoCameraIcon },
  { value: 'events', label: 'School events', icon: CalendarIcon },
  { value: 'assessments', label: 'Assessments', icon: ClipboardDocumentCheckIcon }
];

const ConferenceCard = ({ conference, mine }) => (
  <Card className="flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-display text-base font-bold text-ink-950">{conference.title}</h3>
      <Badge tone={conference.status === 'live' ? 'danger' : 'info'} dot>
        {conference.status}
      </Badge>
    </div>
    <p className="mt-1 text-xs text-ink-600">
      {mine
        ? 'You are the host'
        : conference.host
          ? `${conference.host.firstName} ${conference.host.lastName}`
          : 'Unknown host'}
    </p>
    {conference.description && (
      <p className="mt-3 line-clamp-2 text-sm text-ink-600">{conference.description}</p>
    )}
    <p className="mt-3 text-xs text-ink-500">
      {formatEventWhen(conference.scheduledStart) || 'No scheduled time'}
    </p>
    <div className="mt-5">
      <Button
        as={Link}
        to={`/conference/${conference.id}`}
        size="sm"
        variant={conference.status === 'live' ? 'saffron' : 'secondary'}
        icon={conference.status === 'live' ? SignalIcon : VideoCameraIcon}
      >
        {conference.status === 'live' ? 'Join now' : 'Open room'}
      </Button>
    </div>
  </Card>
);

const EventCard = ({ event }) => (
  <Card className="flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-display text-base font-bold text-ink-950">{event.title}</h3>
      <Badge tone="neutral">{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</Badge>
    </div>
    {event.description && (
      <p className="mt-2 line-clamp-2 text-sm text-ink-600">{event.description}</p>
    )}
    <dl className="mt-3 space-y-1.5 text-xs text-ink-500">
      {formatEventWhen(event.startTime) && (
        <div className="flex items-center gap-1.5">
          <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <dt className="sr-only">Starts</dt>
          <dd>{formatEventWhen(event.startTime)}</dd>
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
    <div className="mt-5">
      <Button as={Link} to={`/events/${event.id}`} size="sm" variant="secondary">
        Open event
      </Button>
    </div>
  </Card>
);

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('live');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [conferences, setConferences] = useState([]);
  const [events, setEvents] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const orgId = user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [confRes, eventsRes, assessRes] = await Promise.allSettled([
      listConferences(),
      // Unlike students, a teacher is not special-cased by the events
      // controller, so the organizationId param is honoured and scopes the
      // list to their own school rather than every organization on the server.
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      listAssessments()
    ]);

    const nextErrors = {};

    if (confRes.status === 'fulfilled') {
      setConferences(confRes.value.conferences || []);
    } else {
      nextErrors.live =
        confRes.reason?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description:
                'This server has no LiveKit connection configured, so sessions cannot run.'
            }
          : toErrorState(confRes.reason, 'Could not load live classes');
    }

    if (eventsRes.status === 'fulfilled') {
      setEvents(
        (eventsRes.value.events || []).sort(
          (a, b) => new Date(b.startTime) - new Date(a.startTime)
        )
      );
    } else {
      nextErrors.events = toErrorState(eventsRes.reason, 'Could not load school events');
    }

    if (assessRes.status === 'fulfilled') {
      setAssessments((assessRes.value.assessments || []).filter((a) => a.isActive !== false));
    } else {
      nextErrors.assessments = toErrorState(assessRes.reason, 'Could not load assessments');
    }

    setErrors(nextErrors);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const myConferences = useMemo(
    () => conferences.filter((c) => c.host?.id === user?.id),
    [conferences, user?.id]
  );
  const otherConferences = useMemo(
    () => conferences.filter((c) => c.host?.id !== user?.id),
    [conferences, user?.id]
  );
  const upcomingEvents = useMemo(() => events.filter(isUpcomingEvent), [events]);
  const liveNow = useMemo(() => conferences.filter((c) => c.status === 'live'), [conferences]);

  const livePanel = () => {
    if (errors.live) return <ErrorState {...errors.live} onRetry={load} />;
    if (!conferences.length) {
      return (
        <EmptyState
          icon={VideoCameraIcon}
          title="You have not scheduled a live class"
          description="Create one and every student at your school will see it on their dashboard and be able to join."
          action={
            <Button as={Link} to="/conferences" icon={PlusIcon}>
              Create a live class
            </Button>
          }
        />
      );
    }
    return (
      <div className="space-y-8">
        <SectionBlock
          className="mb-0"
          title="Hosted by you"
          description={
            myConferences.length
              ? undefined
              : 'You are not hosting any sessions yet.'
          }
        >
          {myConferences.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myConferences.map((c) => (
                <ConferenceCard key={c.id} conference={c} mine />
              ))}
            </div>
          ) : null}
        </SectionBlock>

        {otherConferences.length > 0 && (
          <SectionBlock
            className="mb-0"
            title="Elsewhere in your school"
            description="Sessions hosted by your colleagues."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherConferences.map((c) => (
                <ConferenceCard key={c.id} conference={c} />
              ))}
            </div>
          </SectionBlock>
        )}
      </div>
    );
  };

  const eventsPanel = () => {
    if (errors.events) return <ErrorState {...errors.events} onRetry={load} />;
    if (!events.length) {
      return (
        <EmptyState
          icon={CalendarIcon}
          title="Your school has no events yet"
          description="Workshops, seminars and drives you create for your school will be listed here."
          action={
            <Button as={Link} to="/events/new" icon={PlusIcon}>
              Create an event
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    );
  };

  const assessmentsPanel = () => {
    if (errors.assessments) return <ErrorState {...errors.assessments} onRetry={load} />;
    if (!assessments.length) {
      return (
        <EmptyState
          icon={ClipboardDocumentCheckIcon}
          title="No assessments published"
          description="Assessments are authored by recruiters and placement officers; published ones appear here for you to point students at."
        />
      );
    }
    return (
      <>
        <p className="mb-4 rounded-xl border border-ink-950/15 bg-bone-100 px-4 py-3 text-sm text-ink-700">
          These are every published assessment on the platform. Authoring is
          restricted to recruiters, placement officers and admins, and the API has
          no filter for the assessments a single teacher set.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <Card key={a.id}>
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
                  <dt className="text-ink-500">Total</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">
                    {a.totalMarks ?? '—'}
                  </dd>
                </div>
              </dl>
              {a.creator && (
                <p className="mt-3 text-xs text-ink-500">
                  Set by {a.creator.firstName} {a.creator.lastName}
                </p>
              )}
            </Card>
          ))}
        </div>
      </>
    );
  };

  const panels = { live: livePanel, events: eventsPanel, assessments: assessmentsPanel };

  return (
    <PageShell>
      <PageHeader
        eyebrow={user?.organization?.name || 'School'}
        title={`Good to see you, ${user?.firstName || 'teacher'}`}
        lead="Your live classes, your school's events, and the assessments your students can take."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/events/new" variant="secondary" icon={PlusIcon}>
              New event
            </Button>
            <Button as={Link} to="/conferences" icon={VideoCameraIcon}>
              Live classes
            </Button>
          </div>
        }
      />

      <SectionBlock>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Your live classes"
            value={errors.live ? '—' : myConferences.length}
            icon={VideoCameraIcon}
            loading={loading}
            to="/conferences"
          />
          <StatTile
            label="Live right now"
            value={errors.live ? '—' : liveNow.length}
            icon={SignalIcon}
            accent="saffron"
            loading={loading}
            hint="Across your school"
          />
          <StatTile
            label="Upcoming school events"
            value={errors.events ? '—' : upcomingEvents.length}
            icon={CalendarIcon}
            accent="india"
            loading={loading}
            to="/events"
          />
          <StatTile
            label="Assessments published"
            value={errors.assessments ? '—' : assessments.length}
            icon={ClipboardDocumentCheckIcon}
            accent="azure"
            loading={loading}
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

      <SectionBlock className="mt-10 mb-0">
        <Card className="border-dashed">
          <div className="flex items-start gap-3">
            <UserGroupIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" />
            <div>
              <h2 className="font-display text-base font-bold text-ink-950">
                Class rosters are not available yet
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Listing the students at your school needs an endpoint a teacher is
                allowed to call. Today <code className="text-ink-800">GET /api/users</code>{' '}
                is restricted to admins and placement officers, so nothing here can
                show a roster without inventing one.
              </p>
            </div>
          </div>
        </Card>
      </SectionBlock>
    </PageShell>
  );
};

export default TeacherDashboard;
