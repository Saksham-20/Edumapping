// client/src/pages/dashboard/CareerCounselorDashboard.js
//
// The career counsellor's screen: the material they point students at, and the
// sessions they run themselves.
//
// Endpoints this role is permitted to call, verified against the running API:
//   GET /api/jobs           — optionalAuth; the opportunity landscape
//   GET /api/events         — scoped to the school with organizationId
//   GET /api/assessments    — what a student can be assessed on
//   GET /api/conferences    — counselling sessions (this role may host)
//
// A counsellor's most important view — the students they advise, and how those
// students are progressing — has no endpoint behind it. `GET /api/users` is
// admin/TPO only, `GET /api/applications` returns only the caller's own
// applications for a non-recruiter, and `GET /api/achievements` has no
// organization filter, only `userId`. The students panel says so instead of
// listing strangers from other institutions.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
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
  StatusBadge,
  Tabs
} from '../../components/ui';
import {
  BriefcaseIcon,
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
  { value: 'jobs', label: 'Opportunities', icon: BriefcaseIcon },
  { value: 'events', label: 'School events', icon: CalendarIcon },
  { value: 'sessions', label: 'Counselling sessions', icon: VideoCameraIcon },
  { value: 'students', label: 'Students', icon: UserGroupIcon }
];

const CareerCounselorDashboard = () => {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [tab, setTab] = useState('jobs');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [jobsRes, eventsRes, confRes, assessRes] = await Promise.allSettled([
      api.get('/jobs', { params: { limit: 50, status: 'active' }, silent: true }),
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      listConferences(),
      listAssessments()
    ]);

    const nextErrors = {};

    if (jobsRes.status === 'fulfilled') {
      setJobs(jobsRes.value.jobs || []);
    } else {
      nextErrors.jobs = toErrorState(jobsRes.reason, 'Could not load opportunities');
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

    if (confRes.status === 'fulfilled') {
      setConferences(confRes.value.conferences || []);
    } else {
      nextErrors.sessions =
        confRes.reason?.response?.status === 503
          ? {
              title: 'Live sessions are not switched on yet',
              description: 'This server has no LiveKit connection configured.'
            }
          : toErrorState(confRes.reason, 'Could not load counselling sessions');
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

  const upcomingEvents = useMemo(() => events.filter(isUpcomingEvent), [events]);
  const mySessions = useMemo(
    () => conferences.filter((c) => c.host?.id === user?.id),
    [conferences, user?.id]
  );

  const jobsPanel = () => {
    if (errors.jobs) return <ErrorState {...errors.jobs} onRetry={load} />;
    if (!jobs.length) {
      return (
        <EmptyState
          icon={BriefcaseIcon}
          title="No open opportunities right now"
          description="Roles posted by recruiters and placement officers appear here for you to discuss with students."
          action={
            <Button as={Link} to="/jobs" variant="secondary">
              Browse all roles
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Card key={job.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-ink-950">{job.title}</h3>
                <p className="mt-1 text-xs text-ink-600">
                  {job.organization?.name || 'Unknown employer'}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-ink-500">
              {job.location && (
                <div className="flex items-center gap-1.5">
                  <MapPinIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <dt className="sr-only">Location</dt>
                  <dd className="truncate">{job.location}</dd>
                </div>
              )}
              {job.jobType && (
                <div className="flex items-center gap-1.5">
                  <dt>Type</dt>
                  <dd>{String(job.jobType).replace(/_/g, ' ')}</dd>
                </div>
              )}
              {job.applicationDeadline && (
                <div className="flex items-center gap-1.5">
                  <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <dt className="sr-only">Applications close</dt>
                  <dd>Closes {new Date(job.applicationDeadline).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5">
              <Button as={Link} to={`/jobs/${job.id}`} size="sm" variant="secondary">
                Open role
              </Button>
            </div>
          </Card>
        ))}
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
          description="Career talks, drives and workshops you schedule under your school will be listed here."
          action={
            <Button as={Link} to="/events/new" icon={PlusIcon}>
              Schedule a career session
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Card key={e.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-950">{e.title}</h3>
              <Badge tone="neutral">{EVENT_TYPE_LABELS[e.eventType] || e.eventType}</Badge>
            </div>
            {e.description && (
              <p className="mt-2 line-clamp-2 text-sm text-ink-600">{e.description}</p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
              <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {formatEventWhen(e.startTime) || 'No scheduled time'}
            </p>
            <p className="mt-1.5 text-xs text-ink-600 tabular-nums">
              {e.registrationCount} registered
              {e.maxParticipants ? ` of ${e.maxParticipants}` : ''}
            </p>
            <div className="mt-5">
              <Button as={Link} to={`/events/${e.id}`} size="sm" variant="secondary">
                Open event
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const sessionsPanel = () => {
    if (errors.sessions) return <ErrorState {...errors.sessions} onRetry={load} />;
    if (!conferences.length) {
      return (
        <EmptyState
          icon={VideoCameraIcon}
          title="No counselling sessions scheduled"
          description="Your role can host live sessions. Create one and every student at your school will be able to join it."
          action={
            <Button as={Link} to="/conferences" icon={PlusIcon}>
              Create a session
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conferences.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-950">{c.title}</h3>
              <Badge
                tone={c.status === 'live' ? 'danger' : c.status === 'ended' ? 'neutral' : 'info'}
                dot
              >
                {c.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-600">
              {c.host?.id === user?.id
                ? 'You are the host'
                : c.host
                  ? `${c.host.firstName} ${c.host.lastName}`
                  : 'Unknown host'}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              {formatEventWhen(c.scheduledStart) || 'No scheduled time'}
            </p>
            <div className="mt-5">
              <Button
                as={Link}
                to={`/conference/${c.id}`}
                size="sm"
                variant={c.status === 'live' ? 'saffron' : 'secondary'}
                icon={c.status === 'live' ? SignalIcon : VideoCameraIcon}
                disabled={c.status === 'ended'}
              >
                {c.status === 'live' ? 'Join now' : c.status === 'ended' ? 'Ended' : 'Open room'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const studentsPanel = () => (
    <EmptyState
      icon={UserGroupIcon}
      title="Student caseloads need a school-scoped endpoint"
      description={
        'Listing the students at your school, their applications or their achievements is not ' +
        'possible from this role today. GET /api/users is restricted to admins and placement ' +
        'officers, GET /api/applications returns only your own applications, and achievements can ' +
        'only be fetched one known user at a time. Nothing is shown here rather than a list ' +
        'assembled from other institutions.'
      }
      action={
        <Button as={Link} to="/events" variant="secondary">
          Reach students through events
        </Button>
      }
    />
  );

  const panels = {
    jobs: jobsPanel,
    events: eventsPanel,
    sessions: sessionsPanel,
    students: studentsPanel
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow={user?.organization?.name || 'School'}
        title="Career guidance"
        lead="Open roles, your school's career events, and the sessions you run."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/events/new" variant="secondary" icon={PlusIcon}>
              New event
            </Button>
            <Button as={Link} to="/conferences" icon={VideoCameraIcon}>
              Sessions
            </Button>
          </div>
        }
      />

      <SectionBlock>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Open roles"
            value={errors.jobs ? '—' : jobs.length}
            icon={BriefcaseIcon}
            loading={loading}
            to="/jobs"
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
            label="Sessions you host"
            value={errors.sessions ? '—' : mySessions.length}
            icon={VideoCameraIcon}
            accent="azure"
            loading={loading}
            to="/conferences"
          />
          <StatTile
            label="Assessments published"
            value={errors.assessments ? '—' : assessments.length}
            icon={ClipboardDocumentCheckIcon}
            accent="saffron"
            loading={loading}
            hint="Platform-wide"
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
    </PageShell>
  );
};

export default CareerCounselorDashboard;
