// client/src/pages/dashboard/PrincipalDashboard.js
//
// The principal's view of their school.
//
// The obvious thing a principal wants — headcounts of students and staff — has
// no endpoint they are allowed to call. `GET /api/statistics/*` is
// `requireRole('admin')` or `requireRole('tpo')`, and `GET /api/users` is
// `requireRole('admin', 'tpo')`; a principal gets a 403 from every one of them
// (verified against the running API). Rather than print a plausible-looking
// number, this page counts only what it can actually read and says plainly
// what is missing and why.
//
// What it does read:
//   GET /api/events?organizationId=  — the school's own activity
//   GET /api/conferences             — live teaching happening in the school
//   GET /api/assessments             — what students can be assessed on
//   GET /api/organizations/:id       — the school record itself
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  formatEventWhen,
  getOrganization,
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
  DetailRow,
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
  BuildingOffice2Icon,
  CalendarIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  PlusIcon,
  SignalIcon,
  UserGroupIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'activity', label: 'Activity', icon: CalendarIcon },
  { value: 'live', label: 'Live teaching', icon: VideoCameraIcon },
  { value: 'school', label: 'School record', icon: BuildingOffice2Icon }
];

const PrincipalDashboard = () => {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [tab, setTab] = useState('activity');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [events, setEvents] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [organization, setOrganization] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [eventsRes, confRes, assessRes, orgRes] = await Promise.allSettled([
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      listConferences(),
      listAssessments(),
      orgId ? getOrganization(orgId) : Promise.resolve(null)
    ]);

    const nextErrors = {};

    if (eventsRes.status === 'fulfilled') {
      setEvents(
        (eventsRes.value.events || []).sort(
          (a, b) => new Date(b.startTime) - new Date(a.startTime)
        )
      );
    } else {
      nextErrors.activity = toErrorState(eventsRes.reason, "Could not load your school's events");
    }

    if (confRes.status === 'fulfilled') {
      setConferences(confRes.value.conferences || []);
    } else {
      nextErrors.live =
        confRes.reason?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description: 'This server has no LiveKit connection configured.'
            }
          : toErrorState(confRes.reason, 'Could not load live classes');
    }

    if (assessRes.status === 'fulfilled') {
      setAssessments((assessRes.value.assessments || []).filter((a) => a.isActive !== false));
    } else {
      nextErrors.assessments = toErrorState(assessRes.reason, 'Could not load assessments');
    }

    if (orgRes.status === 'fulfilled') {
      setOrganization(orgRes.value?.organization || null);
    } else {
      nextErrors.school = toErrorState(orgRes.reason, 'Could not load the school record');
    }

    setErrors(nextErrors);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => events.filter(isUpcomingEvent), [events]);
  const past = useMemo(() => events.filter((e) => !isUpcomingEvent(e)), [events]);
  // Every registration on the school's own events. Not a headcount of students
  // — a student who signs up for three events counts three times — so it is
  // labelled as sign-ups, not people.
  const totalSignups = useMemo(
    () => events.reduce((sum, e) => sum + (e.registrationCount || 0), 0),
    [events]
  );
  const liveNow = useMemo(() => conferences.filter((c) => c.status === 'live'), [conferences]);

  const eventRow = (e) => (
    <Card key={e.id} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink-950">{e.title}</h3>
        <Badge tone="neutral">{EVENT_TYPE_LABELS[e.eventType] || e.eventType}</Badge>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
        <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {formatEventWhen(e.startTime) || 'No scheduled time'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={e.status} />
        <span className="text-xs text-ink-600 tabular-nums">
          {e.registrationCount} registered
          {e.maxParticipants ? ` of ${e.maxParticipants}` : ''}
        </span>
      </div>
      <div className="mt-5">
        <Button as={Link} to={`/events/${e.id}`} size="sm" variant="secondary">
          Open event
        </Button>
      </div>
    </Card>
  );

  const activityPanel = () => {
    if (errors.activity) return <ErrorState {...errors.activity} onRetry={load} />;
    if (!events.length) {
      return (
        <EmptyState
          icon={CalendarIcon}
          title="Your school has run no events yet"
          description="Once staff schedule workshops, seminars or drives under your school, they and their registration numbers appear here."
          action={
            <Button as={Link} to="/events/new" icon={PlusIcon}>
              Create the first event
            </Button>
          }
        />
      );
    }
    return (
      <div className="space-y-8">
        <SectionBlock className="mb-0" title="Coming up">
          {upcoming.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map(eventRow)}</div>
          ) : (
            <p className="text-sm text-ink-600">Nothing is scheduled ahead of today.</p>
          )}
        </SectionBlock>
        {past.length > 0 && (
          <SectionBlock className="mb-0" title="Already run">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{past.map(eventRow)}</div>
          </SectionBlock>
        )}
      </div>
    );
  };

  const livePanel = () => {
    if (errors.live) return <ErrorState {...errors.live} onRetry={load} />;
    if (!conferences.length) {
      return (
        <EmptyState
          icon={VideoCameraIcon}
          title="No live classes yet"
          description="Live sessions hosted by your teachers appear here while they are scheduled and while they run."
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
        {conferences.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-bold text-ink-950">{c.title}</h3>
              <Badge tone={c.status === 'live' ? 'danger' : c.status === 'ended' ? 'neutral' : 'info'} dot>
                {c.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-600">
              {c.host ? `${c.host.firstName} ${c.host.lastName}` : 'Unknown host'}
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
                {c.status === 'live' ? 'Sit in' : c.status === 'ended' ? 'Ended' : 'Open room'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const schoolPanel = () => {
    if (errors.school) return <ErrorState {...errors.school} onRetry={load} />;
    if (!organization) {
      return (
        <EmptyState
          icon={BuildingOffice2Icon}
          title="No school record"
          description="Your account is not attached to an organization, so there is nothing to show."
        />
      );
    }
    return (
      <Card>
        <dl className="divide-y divide-ink-950/10">
          <DetailRow label="Name">{organization.name}</DetailRow>
          <DetailRow label="Type">{organization.type}</DetailRow>
          <DetailRow label="Verified">
            <StatusBadge status={organization.isVerified ? 'approved' : 'pending'} />
          </DetailRow>
          <DetailRow label="Domain">{organization.domain}</DetailRow>
          <DetailRow label="Website">
            {organization.website ? (
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                className="text-azure-700 underline underline-offset-2"
              >
                {organization.website}
              </a>
            ) : null}
          </DetailRow>
          <DetailRow label="Contact email">{organization.contactEmail}</DetailRow>
          <DetailRow label="Contact phone">{organization.contactPhone}</DetailRow>
          <DetailRow label="Address">{organization.address}</DetailRow>
          <DetailRow label="On EduMapping since">
            {organization.createdAt ? new Date(organization.createdAt).toLocaleDateString() : null}
          </DetailRow>
        </dl>
      </Card>
    );
  };

  const panels = { activity: activityPanel, live: livePanel, school: schoolPanel };

  return (
    <PageShell>
      <PageHeader
        eyebrow={organization?.name || user?.organization?.name || 'School'}
        title={`Principal's overview`}
        lead="Activity running under your school, counted from the records the API will show you."
        actions={
          <Button as={Link} to="/events/new" icon={PlusIcon}>
            New event
          </Button>
        }
      />

      <SectionBlock>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Upcoming events"
            value={errors.activity ? '—' : upcoming.length}
            icon={CalendarIcon}
            loading={loading}
            hint="Scheduled under your school"
            to="/events"
          />
          <StatTile
            label="Event sign-ups"
            value={errors.activity ? '—' : totalSignups}
            icon={UserGroupIcon}
            accent="india"
            loading={loading}
            hint="Registrations, not distinct students"
          />
          <StatTile
            label="Live classes"
            value={errors.live ? '—' : conferences.length}
            icon={VideoCameraIcon}
            accent="azure"
            loading={loading}
            hint={errors.live ? 'Unavailable' : `${liveNow.length} running now`}
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

      <SectionBlock className="mt-10 mb-0">
        <Card className="border-dashed">
          <div className="flex items-start gap-3">
            <UserGroupIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" />
            <div>
              <h2 className="font-display text-base font-bold text-ink-950">
                Student and staff headcounts are not available yet
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                The API exposes no per-organization statistics or user listing a
                principal may call: <code className="text-ink-800">GET /api/statistics/*</code>{' '}
                is limited to admins and placement officers, and{' '}
                <code className="text-ink-800">GET /api/users</code> to admins and
                placement officers. Until a school-scoped endpoint exists, this page
                will not display a headcount rather than estimate one.
              </p>
            </div>
          </div>
        </Card>
      </SectionBlock>
    </PageShell>
  );
};

export default PrincipalDashboard;
