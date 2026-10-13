// client/src/pages/dashboard/TeacherDashboard.js
//
// A teacher's home screen. Built on the three endpoints the `teacher` role is
// actually permitted to call, verified against the running API:
//
//   GET /api/conferences   — live classes, split into "mine" and "my school's"
//   GET /api/events        — school events, scoped with organizationId
//   GET /api/users         — the school's students, scoped by the server
//
// The student roster comes from `GET /api/users`, which is pinned server-side
// to the caller's own organization for school roles, so it can only ever return
// this teacher's school.
//
// There is no Assessments tab. Teachers cannot create assessments, and the
// server shows them none (assessments are a stage of a job application, scoped
// to the employer and the applicants), so the tab could only ever be empty
// while its copy promised "published ones appear here".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  formatEventWhen,
  isUpcomingEvent,
  fullName,
  listConferences,
  listEvents,
  listOrganizationUsers,
  toErrorState
} from '../../services/school';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  SectionBlock,
  SkeletonCard,
  StatStrip,
  StatTile,
  StatusBadge,
  Tabs
} from '../../components/ui';
import {
  CalendarIcon,
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
  { value: 'students', label: 'My students', icon: UserGroupIcon }
];

const ConferenceCard = ({ conference, mine }) => (
  <Card className="flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <h3 className="min-w-0 break-words font-display text-base font-bold text-ink-950">
        {conference.title}
      </h3>
      <StatusBadge status={conference.status} />
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
        disabled={conference.status === 'ended'}
      >
        {conference.status === 'live'
          ? 'Join now'
          : conference.status === 'ended'
            ? 'Ended'
            : 'Open room'}
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
  const [students, setStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');

  const orgId = user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [confRes, eventsRes, studentsRes] = await Promise.allSettled([
      listConferences(),
      // Unlike students, a teacher is not special-cased by the events
      // controller, so the organizationId param is honoured and scopes the
      // list to their own school rather than every organization on the server.
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      orgId ? listOrganizationUsers(orgId, { role: 'student' }) : Promise.resolve(null)
    ]);

    const nextErrors = {};

    if (confRes.status === 'fulfilled') {
      setConferences(confRes.value.conferences || []);
    } else {
      nextErrors.live =
        confRes.reason?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description: 'Live classes have not been set up on EduMapping yet. Please check back later.'
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

    if (studentsRes.status === 'fulfilled') {
      setStudents(studentsRes.value?.users || []);
    } else {
      nextErrors.students = toErrorState(studentsRes.reason, 'Could not load your students');
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
  // "Elsewhere in your school" used to be every session the API returned that
  // the teacher did not host, which included sessions open to all of
  // EduMapping from other institutions — listed under "your colleagues".
  // Only this school's own, still-running-or-upcoming sessions belong there.
  const otherConferences = useMemo(
    () =>
      conferences.filter(
        (c) => c.host?.id !== user?.id && c.organization?.id === orgId && c.status !== 'ended'
      ),
    [conferences, user?.id, orgId]
  );
  const upcomingEvents = useMemo(() => events.filter(isUpcomingEvent), [events]);
  const liveNow = useMemo(
    () => conferences.filter((c) => c.status === 'live' && c.organization?.id === orgId),
    [conferences, orgId]
  );

  const livePanel = () => {
    if (errors.live) return <ErrorState {...errors.live} onRetry={load} />;
    if (!myConferences.length && !otherConferences.length) {
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

  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (u) => fullName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  const studentsPanel = () => {
    if (errors.students) return <ErrorState {...errors.students} onRetry={load} />;
    if (!students.length) {
      return (
        <EmptyState
          icon={UserGroupIcon}
          title="No students have registered against your school yet"
          description="Students who sign up under your school appear here."
        />
      );
    }
    return (
      <div className="space-y-5">
        <Input
          label="Find a student"
          placeholder="Search by name or email"
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
        />
        {visibleStudents.length === 0 ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No student matches that search"
            description="Try a different name or email address."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStudents.map((u) => (
              <Card key={u.id} className="flex items-center gap-3">
                <Avatar src={u.profilePicture} name={fullName(u)} size="md" />
                <div className="min-w-0">
                  {/* Staff can open a student at their own school; the server
                      404s anyone else's, so the link cannot leak across schools. */}
                  <Link
                    to={`/users/${u.id}`}
                    className="block truncate font-semibold text-ink-950 underline-offset-2 hover:underline"
                  >
                    {fullName(u) || 'Unnamed account'}
                  </Link>
                  <p className="truncate text-xs text-ink-500">{u.email}</p>
                  {!u.isActive && (
                    <Badge tone="neutral" className="mt-1.5">
                      {u.approvalStatus === 'pending' ? 'Awaiting approval' : 'Inactive'}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const panels = {
    live: livePanel,
    events: eventsPanel,
    students: studentsPanel
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow={user?.organization?.name || 'School'}
        title={`Good to see you, ${user?.firstName || 'teacher'}`}
        lead="Your live classes, your school's events and your students."
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
        <StatStrip>
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
            label="Students"
            value={errors.students ? '—' : students.filter((u) => u.isActive).length}
            icon={UserGroupIcon}
            accent="azure"
            loading={loading}
            hint="At your school"
          />
        </StatStrip>
      </SectionBlock>

      <Tabs className="mb-6 w-fit max-w-full" value={tab} onChange={setTab} tabs={TABS} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        panels[tab]()
      )}

    </PageShell>
  );
};

export default TeacherDashboard;
