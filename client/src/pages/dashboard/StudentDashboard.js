// client/src/pages/dashboard/StudentDashboard.js
//
// The student's home surface: six independent panels fed by six endpoints.
// Each panel owns its own failure — a dead `/achievements` must not blank the
// applications list — so the fetch is `allSettled` and the page only shows a
// whole-page error when every request failed.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
// The shared helper, not a local copy: this file used to carry its own
// unweighted version that ignored achievements and linkedinUrl, so the
// dashboard called a profile "complete" that the Profile page scored at 90%.
import { calculateProfileCompletion } from '../../utils/helpers';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  SkeletonCard,
  StatTile,
  StatusBadge,
  Tabs,
  cx
} from '../../components/ui';
import {
  BriefcaseIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  StarIcon,
  UserGroupIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'overview', label: 'Overview', icon: ChartBarIcon },
  { value: 'applications', label: 'Applications', icon: DocumentTextIcon },
  { value: 'opportunities', label: 'Opportunities', icon: BriefcaseIcon },
  { value: 'events', label: 'Events', icon: CalendarIcon }
];

// Statuses that mean the application is still moving. `selected`, `rejected`
// and `withdrawn` are terminal.
const IN_PROGRESS = ['applied', 'screening', 'shortlisted', 'interviewed'];

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

/** Sums a `[{ status, count }]` aggregate, optionally filtered to some statuses. */
const sumByStatus = (rows, statuses) =>
  (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.status && (!statuses || statuses.includes(r.status)))
    .reduce((sum, r) => sum + (parseInt(r.count, 10) || 0), 0);

const ProgressBar = ({ value, label }) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={label}
    className="h-2 w-full overflow-hidden rounded-full bg-bone-200"
  >
    <div className="h-full rounded-full bg-saffron-500 transition-all duration-300" style={{ width: `${value}%` }} />
  </div>
);

const ApplicationRow = ({ application }) => {
  const applied = formatDate(application.appliedAt);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6">
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-sm font-bold text-ink-950">
          {application.job?.title || 'Job title unavailable'}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
          <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {application.job?.organization?.name || 'Organization unavailable'}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
          <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {application.job?.location || 'Location unavailable'}
        </p>
        {applied && <p className="mt-2 text-xs text-ink-500">Applied {applied}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={application.status || 'unknown'} />
        <Button
          as={Link}
          to={`/applications/${application.id}`}
          size="sm"
          variant="secondary"
          iconRight={ArrowRightIcon}
        >
          View
        </Button>
      </div>
    </li>
  );
};

const NoApplications = () => (
  <EmptyState
    icon={DocumentTextIcon}
    title="No applications yet"
    description="Browse the open roles and apply to the ones that fit you."
    action={
      <Button as={Link} to="/jobs" icon={PlusIcon}>
        Browse jobs
      </Button>
    }
  />
);

const StudentDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState({
    applications: [],
    recommendedJobs: [],
    upcomingEvents: [],
    achievements: [],
    profile: null,
    statsRows: []
  });
  const [loading, setLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setAllFailed(false);

    // `silent` everywhere: this page renders its own error surfaces, and the
    // shared interceptor would otherwise toast once per failed panel.
    const results = await Promise.allSettled([
      api.get('/applications', { params: { limit: 10 }, silent: true }),
      api.get('/jobs/recommended', { params: { limit: 6 }, silent: true }),
      api.get('/events', { params: { upcoming: true, limit: 5 }, silent: true }),
      api.get('/applications/stats', { silent: true }),
      // Scoped to this student explicitly: unscoped, `/achievements` returns
      // every user's achievements — this panel was showing other students'
      // awards, from other organizations, as the viewer's own.
      api.get('/achievements', { params: { userId: user?.id, limit: 5 }, silent: true }),
      api.get('/users/profile', { silent: true })
    ]);

    const value = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);
    const profile = value(5)?.user || null;

    setData({
      applications: value(0)?.applications || [],
      recommendedJobs: value(1)?.jobs || [],
      upcomingEvents: value(2)?.events || [],
      statsRows: value(3)?.stats?.byStatus || [],
      achievements: value(4)?.achievements || [],
      profile
    });

    setAllFailed(results.every((r) => r.status === 'rejected'));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const rows = data.statsRows;
    return {
      totalApplications: sumByStatus(rows),
      activeApplications: sumByStatus(rows, IN_PROGRESS),
      interviewed: sumByStatus(rows, ['interviewed']),
      offers: sumByStatus(rows, ['selected']),
      profileCompletion: calculateProfileCompletion(data.profile, user?.role),
      skillsCount: Array.isArray(data.profile?.studentProfile?.skills)
        ? data.profile.studentProfile.skills.length
        : 0,
      achievementsCount: data.achievements.length
    };
  }, [data, user?.role]);

  const complete = stats.profileCompletion === 100;

  // The recommendation endpoint scores on skills, branch and CGPA. If those are
  // filled in, an empty list means "nothing open matches", not "finish your
  // profile" — the two need different empty states.
  const profileHasMatchingFields = Boolean(
    stats.skillsCount > 0 && data.profile?.studentProfile?.branch
  );

  if (allFailed) {
    return (
      <PageShell width="wide">
        <PageHeader eyebrow="Student" title="Dashboard" />
        <ErrorState
          title="Could not load your dashboard"
          description="None of the dashboard panels responded. Check your connection and try again."
          onRetry={load}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Student"
        title={`Welcome back, ${user?.firstName || 'student'}`}
        lead="Your applications, recommended roles and upcoming campus events."
        actions={
          <>
            <Button as={Link} to="/profile" variant="secondary" icon={AcademicCapIcon}>
              Edit profile
            </Button>
            <Button as={Link} to="/jobs" icon={PlusIcon}>
              Browse jobs
            </Button>
          </>
        }
      />

      {/* Profile completion. Only meaningful once the profile actually loaded —
          a failed /users/profile reads as 0% and would nag for no reason. */}
      {!loading && data.profile && (
        <Card className={cx('mb-8', complete && 'border-india-600/30 bg-india-50')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                className={cx(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                  complete
                    ? 'border-india-600/30 bg-white text-india-700'
                    : 'border-ink-950/15 bg-bone-100 text-ink-700'
                )}
              >
                {complete ? (
                  <CheckCircleIcon className="h-5 w-5" strokeWidth={1.8} />
                ) : (
                  <AcademicCapIcon className="h-5 w-5" strokeWidth={1.8} />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-ink-950">
                  {complete ? 'Your profile is complete' : 'Complete your profile'}
                </h2>
                <p className="mt-1 text-sm text-ink-600">
                  {complete
                    ? 'Recruiters can see everything they need to shortlist you.'
                    : 'Academic details, skills and achievements make you discoverable to recruiters.'}
                </p>
                {!complete && (
                  <div className="mt-3 max-w-sm">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-ink-600">
                      <span>Completion</span>
                      <span className="font-mono font-semibold tabular-nums text-ink-950">
                        {stats.profileCompletion}%
                      </span>
                    </div>
                    <ProgressBar value={stats.profileCompletion} label="Profile completion" />
                  </div>
                )}
              </div>
            </div>
            <Button as={Link} to="/profile" variant={complete ? 'secondary' : 'saffron'}>
              {complete ? 'View profile' : 'Complete profile'}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total applications"
          value={stats.totalApplications}
          hint="Across all jobs"
          icon={DocumentTextIcon}
          to="/applications"
          loading={loading}
        />
        <StatTile
          label="In progress"
          value={stats.activeApplications}
          hint="Not yet decided"
          icon={BriefcaseIcon}
          accent="saffron"
          to="/applications"
          loading={loading}
        />
        <StatTile
          label="Interviewed"
          value={stats.interviewed}
          hint="Reached the interview stage"
          icon={UserGroupIcon}
          accent="azure"
          to="/applications"
          loading={loading}
        />
        <StatTile
          label="Offers"
          value={stats.offers}
          hint="Applications marked selected"
          icon={StarIcon}
          accent="india"
          to="/applications"
          loading={loading}
        />
      </div>

      <Tabs className="mb-6 w-fit max-w-full" tabs={TABS} value={tab} onChange={setTab} />

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" lines={5} />
          <SkeletonCard lines={4} />
        </div>
      )}

      {!loading && tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card padded={false}>
              <div className="px-5 py-4 sm:px-6">
                <CardHeader
                  title="Recent applications"
                  actions={
                    <Button as={Link} to="/applications" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                      View all
                    </Button>
                  }
                />
              </div>
              {data.applications.length > 0 ? (
                <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                  {data.applications.slice(0, 5).map((a) => (
                    <ApplicationRow key={a.id} application={a} />
                  ))}
                </ul>
              ) : (
                <div className="border-t border-ink-950/10 p-5 sm:p-6">
                  <NoApplications />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Profile summary" />
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
                    Skills
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-950">
                    {stats.skillsCount}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
                    Achievements
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-950">
                    {stats.achievementsCount}
                  </dd>
                </div>
              </dl>
              <Button as={Link} to="/profile" variant="secondary" fullWidth className="mt-5">
                {complete ? 'View profile' : 'Update profile'}
              </Button>
            </Card>

            <Card>
              <CardHeader title="Quick actions" />
              <div className="mt-4 space-y-2">
                {[
                  { to: '/resume', label: 'Update resume', icon: DocumentTextIcon },
                  { to: '/jobs', label: 'Browse jobs', icon: BriefcaseIcon },
                  { to: '/events', label: 'View events', icon: CalendarIcon }
                ].map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="flex items-center gap-3 rounded-xl border border-ink-950/15 px-4 py-3 text-sm font-medium text-ink-800 transition-colors hover:border-ink-950/40 hover:bg-bone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                  >
                    <action.icon aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.8} />
                    {action.label}
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {!loading && tab === 'applications' && (
        <Card padded={false}>
          <div className="px-5 py-4 sm:px-6">
            <CardHeader title="All applications" description="Your ten most recent applications." />
          </div>
          {data.applications.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {data.applications.map((a) => (
                <ApplicationRow key={a.id} application={a} />
              ))}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <NoApplications />
            </div>
          )}
        </Card>
      )}

      {!loading && tab === 'opportunities' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card padded={false}>
            <div className="px-5 py-4 sm:px-6">
              <CardHeader
                title="Recommended jobs"
                description="Ranked by how your skills, CGPA and branch line up with the posting."
                actions={
                  <Button as={Link} to="/jobs" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                    All jobs
                  </Button>
                }
              />
            </div>
            {data.recommendedJobs.length > 0 ? (
              <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                {data.recommendedJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6"
                  >
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-ink-950">
                        {job.title || 'Job title unavailable'}
                      </h3>
                      <p className="mt-1 text-xs text-ink-600">
                        {job.organization?.name || 'Organization unavailable'}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                        <span className="flex items-center gap-1.5">
                          <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                          {job.location || 'Location unavailable'}
                        </span>
                        {/* The API's matchScore is an unbounded points total
                            (10 per matching skill, plus eligibility bonuses),
                            not a percentage — never render it with a % sign. */}
                        {Number.isFinite(Number(job.matchScore)) && Number(job.matchScore) > 0 && (
                          <span className="font-mono font-semibold text-india-700">
                            match score {Math.round(job.matchScore)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button as={Link} to={`/jobs/${job.id}`} size="sm" variant="secondary">
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-ink-950/10 p-5 sm:p-6">
                {/* Two different reasons produce an empty list, and telling a
                    student with a finished profile to "complete your profile"
                    sends them somewhere there is nothing left to do. */}
                {profileHasMatchingFields ? (
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="Nothing matches right now"
                    description="No open posting fits your profile yet. Browse the full board — new roles land regularly."
                    action={
                      <Button as={Link} to="/jobs" variant="secondary">
                        Browse all jobs
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="No recommendations yet"
                    description="Add your course, branch and skills so we can match you against open roles."
                    action={
                      <Button as={Link} to="/profile" variant="secondary">
                        Complete profile
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="px-5 py-4 sm:px-6">
              <CardHeader
                title="Recent achievements"
                actions={
                  <Button as={Link} to="/profile" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                    Add
                  </Button>
                }
              />
            </div>
            {data.achievements.length > 0 ? (
              <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                {data.achievements.map((achievement) => (
                  <li key={achievement.id} className="px-5 py-4 sm:px-6">
                    <h3 className="font-display text-sm font-bold text-ink-950">
                      {achievement.title || 'Achievement title unavailable'}
                    </h3>
                    <p className="mt-1 text-xs text-ink-600">
                      {achievement.issuingOrganization || 'Organization unavailable'}
                    </p>
                    {formatDate(achievement.issueDate) && (
                      <p className="mt-1 text-xs text-ink-500">{formatDate(achievement.issueDate)}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-ink-950/10 p-5 sm:p-6">
                <EmptyState
                  icon={TrophyIcon}
                  title="No achievements yet"
                  description="Certifications, awards and competition results all count."
                  action={
                    <Button as={Link} to="/profile" variant="secondary">
                      Add an achievement
                    </Button>
                  }
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {!loading && tab === 'events' && (
        <Card padded={false}>
          <div className="px-5 py-4 sm:px-6">
            <CardHeader
              title="Upcoming events"
              actions={
                <Button as={Link} to="/events" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                  All events
                </Button>
              }
            />
          </div>
          {data.upcomingEvents.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {data.upcomingEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-ink-950">
                      {event.title || 'Event title unavailable'}
                    </h3>
                    <p className="mt-1 text-xs text-ink-600">
                      {event.organization?.name || 'Organization unavailable'}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                      <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {formatDateTime(event.startTime) || 'Date unavailable'}
                    </p>
                    {event.location && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                        <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {event.location}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-ink-500 tabular-nums">
                      {Number(event.registrationCount) || 0} registered
                    </span>
                    <Button as={Link} to={`/events/${event.id}`} size="sm" variant="secondary">
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <EmptyState
                icon={CalendarIcon}
                title="No upcoming events"
                description="Drives, workshops and talks scheduled by your institution show up here."
                action={
                  <Button as={Link} to="/events" variant="secondary">
                    Browse all events
                  </Button>
                }
              />
            </div>
          )}
        </Card>
      )}
    </PageShell>
  );
};

export default StudentDashboard;
