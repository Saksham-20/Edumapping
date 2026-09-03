// client/src/pages/dashboard/RecruiterDashboard.js
//
// The recruiter's home surface. Every number here is derived from a response
// field: the org-wide totals come from `/jobs/stats`, and anything computed
// from the ten-row job/application pages says so in its hint rather than
// pretending to be an all-time figure.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  Avatar,
  Badge,
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
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  CalendarIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  StarIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'overview', label: 'Overview', icon: ChartBarIcon },
  { value: 'jobs', label: 'Job postings', icon: BriefcaseIcon },
  { value: 'applications', label: 'Applications', icon: DocumentTextIcon },
  { value: 'candidates', label: 'Top candidates', icon: UserGroupIcon },
  { value: 'events', label: 'Events', icon: CalendarIcon }
];

const PIPELINE_STAGES = [
  'applied',
  'screening',
  'shortlisted',
  'interviewed',
  'selected',
  'rejected',
  'withdrawn'
];

const toInt = (v) => parseInt(v, 10) || 0;

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

const JobRow = ({ job, showOrganization = false }) => (
  <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6">
    <div className="min-w-0 flex-1">
      <h3 className="font-display text-sm font-bold text-ink-950">{job.title}</h3>
      {showOrganization && job.organization?.name && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
          <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {job.organization.name}
        </p>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
        <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {job.location}
        {job.jobType ? ` · ${job.jobType.replace(/_/g, ' ')}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <StatusBadge status={job.status} />
        <span className="text-xs tabular-nums text-ink-500">{toInt(job.applicationCount)} applications</span>
        <span className="text-xs tabular-nums text-ink-500">{toInt(job.viewCount)} views</span>
        {formatDate(job.createdAt) && (
          <span className="text-xs text-ink-500">Posted {formatDate(job.createdAt)}</span>
        )}
      </div>
    </div>
    <Button as={Link} to={`/jobs/${job.id}`} size="sm" variant="secondary" icon={EyeIcon}>
      View
    </Button>
  </li>
);

const NoJobs = () => (
  <EmptyState
    icon={BriefcaseIcon}
    title="No jobs posted yet"
    description="Post your first opening to start attracting candidates."
    action={
      <Button as={Link} to="/jobs/new" icon={PlusIcon}>
        Post a job
      </Button>
    }
  />
);

const ApplicationRow = ({ application, showOrganization = false }) => (
  <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6">
    <div className="min-w-0 flex-1">
      <h3 className="font-display text-sm font-bold text-ink-950">
        {[application.student?.firstName, application.student?.lastName].filter(Boolean).join(' ') ||
          'Candidate unavailable'}
      </h3>
      <p className="mt-1 text-xs text-ink-600">Applied for: {application.job?.title || 'Unknown role'}</p>
      {showOrganization && application.job?.organization?.name && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
          <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {application.job.organization.name}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <StatusBadge status={application.status} />
        {formatDate(application.appliedAt) && (
          <span className="text-xs text-ink-500">{formatDate(application.appliedAt)}</span>
        )}
      </div>
    </div>
    <Button as={Link} to={`/applications/${application.id}`} size="sm" variant="secondary">
      View
    </Button>
  </li>
);

const CandidateCard = ({ student }) => {
  const name = [student.firstName, student.lastName].filter(Boolean).join(' ');
  const p = student.studentProfile;
  const skills = Array.isArray(p?.skills) ? p.skills : [];

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3">
        <Avatar name={name} size="md" />
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink-950">{name || 'Unnamed candidate'}</h3>
          <p className="truncate text-sm text-ink-600">{student.email}</p>
        </div>
      </div>

      {p && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-700">
          <div className="flex items-center gap-2">
            <AcademicCapIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
            <span className="truncate">
              {[p.course, p.branch].filter(Boolean).join(' · ') || 'Course not set'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
            <span>CGPA {p.cgpa ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
            <span>Year {p.yearOfStudy ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
            <span>Grad {p.graduationYear ?? '—'}</span>
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {skills.slice(0, 5).map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
          {skills.length > 5 && (
            <span className="self-center text-xs text-ink-500">+{skills.length - 5} more</span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {p?.resumeUrl && (
          <Button
            as="a"
            href={p.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="secondary"
            icon={DocumentArrowDownIcon}
          >
            Resume
          </Button>
        )}
        <Button as={Link} to={`/users/${student.id}`} size="sm" icon={EyeIcon}>
          View profile
        </Button>
      </div>
    </Card>
  );
};

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const organizationId = user?.organizationId;

  const [data, setData] = useState({
    jobs: [],
    applications: [],
    events: [],
    candidates: [],
    jobStats: {},
    totalApplications: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(
    async (isRefresh = false) => {
      if (!organizationId) {
        setError('Your account is not linked to an organization. Contact an administrator.');
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = { organizationId };
      // `silent` so the shared interceptor does not toast on top of the error
      // panels this page renders itself.
      const results = await Promise.allSettled([
        api.get('/jobs', { params: { ...params, limit: 10 }, silent: true }),
        api.get('/applications', { params: { ...params, limit: 10 }, silent: true }),
        api.get('/events', { params: { ...params, upcoming: true, limit: 5 }, silent: true }),
        api.get('/jobs/stats', { params, silent: true }),
        // Deliberately without `organizationId`. For every other endpoint here
        // that parameter means "my company"; on top-candidates it means "which
        // institution to draw candidates from" and is checked against the
        // recruiter's allowed-institution list, which never contains their own
        // company — so passing it returned 403 and the panel was always empty.
        // Omitted, the server uses this recruiter's own jobs and their full
        // allow-list, which is what this panel is asking for.
        api.get('/users/top-candidates', { params: { limit: 5 }, silent: true })
      ]);

      const value = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);

      setData({
        jobs: value(0)?.jobs || [],
        applications: value(1)?.applications || [],
        events: value(2)?.events || [],
        jobStats: value(3)?.stats || {},
        candidates: value(4)?.candidates || [],
        // The paginated total, not the length of the page we happen to hold.
        totalApplications: value(1)?.pagination?.totalItems ?? null
      });

      if (results.every((r) => r.status === 'rejected')) {
        setError('None of the dashboard panels responded. Check your connection and try again.');
      }

      setLoading(false);
      setRefreshing(false);
    },
    [organizationId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const { jobs, applications, jobStats } = data;
    const byStatus = Array.isArray(jobStats.jobsByStatus) ? jobStats.jobsByStatus : [];

    // Views and applications are summed over the SAME set of jobs, so the ratio
    // between them is meaningful even though it covers only the loaded page.
    const views = jobs.reduce((sum, job) => sum + toInt(job.viewCount), 0);
    const applicationsOnLoadedJobs = jobs.reduce((sum, job) => sum + toInt(job.applicationCount), 0);

    return {
      totalJobs: byStatus.reduce((sum, row) => sum + toInt(row.count), 0),
      activeJobs: toInt(byStatus.find((row) => row.status === 'active')?.count),
      totalApplications: toInt(jobStats.totalApplications ?? data.totalApplications),
      shortlisted: applications.filter((a) => ['shortlisted', 'interviewed'].includes(a.status)).length,
      views,
      // Undefined, not zero, when nothing has been viewed yet — a 0% rate would
      // claim we measured a conversion failure that never had a chance to occur.
      conversion: views > 0 ? Math.round((applicationsOnLoadedJobs / views) * 100) : null,
      loadedJobCount: jobs.length
    };
  }, [data]);

  const pipeline = useMemo(
    () =>
      PIPELINE_STAGES.map((status) => ({
        status,
        count: data.applications.filter((a) => a.status === status).length
      })),
    [data.applications]
  );

  if (error && !loading) {
    return (
      <PageShell width="wide">
        <PageHeader eyebrow="Recruiter" title="Dashboard" />
        <ErrorState
          title="Could not load your dashboard"
          description={error}
          onRetry={organizationId ? () => load() : undefined}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Recruiter"
        title={`Welcome back, ${user?.firstName || 'recruiter'}`}
        lead="Your postings, incoming applications and the candidates worth a second look."
        actions={
          <>
            <Button variant="secondary" onClick={() => load(true)} loading={refreshing} icon={ArrowPathIcon}>
              Refresh
            </Button>
            <Button as={Link} to="/events/new" variant="secondary" icon={CalendarIcon}>
              Schedule event
            </Button>
            <Button as={Link} to="/jobs/new" icon={PlusIcon}>
              Post a job
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Jobs posted"
          value={stats.totalJobs}
          hint="All time"
          icon={BriefcaseIcon}
          to="/jobs"
          loading={loading}
        />
        <StatTile
          label="Active jobs"
          value={stats.activeJobs}
          hint="Accepting applications"
          icon={ChartBarIcon}
          accent="india"
          to="/jobs"
          loading={loading}
        />
        <StatTile
          label="Applications"
          value={stats.totalApplications}
          hint="Across all your jobs"
          icon={DocumentTextIcon}
          accent="azure"
          to="/applications"
          loading={loading}
        />
        <StatTile
          label="Shortlisted"
          value={stats.shortlisted}
          hint="In the 10 most recent applications"
          icon={UserGroupIcon}
          accent="saffron"
          to="/applications"
          loading={loading}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Job views"
          value={stats.views.toLocaleString()}
          hint={`Across your ${stats.loadedJobCount} most recent postings`}
          icon={EyeIcon}
          loading={loading}
        />
        <StatTile
          label="Application rate"
          value={stats.conversion === null ? '—' : `${stats.conversion}%`}
          hint={
            stats.conversion === null
              ? 'No views recorded on these postings yet'
              : 'Applications per view on those postings'
          }
          icon={ChartBarIcon}
          accent="saffron"
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
                  title="Recent job postings"
                  actions={
                    <Button as={Link} to="/jobs/new" size="sm" icon={PlusIcon}>
                      Post job
                    </Button>
                  }
                />
              </div>
              {data.jobs.length > 0 ? (
                <>
                  <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                    {data.jobs.slice(0, 5).map((job) => (
                      <JobRow key={job.id} job={job} />
                    ))}
                  </ul>
                  <div className="border-t border-ink-950/10 px-5 py-3 sm:px-6">
                    <Button as={Link} to="/jobs" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                      View all jobs
                    </Button>
                  </div>
                </>
              ) : (
                <div className="border-t border-ink-950/10 p-5 sm:p-6">
                  <NoJobs />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card padded={false}>
              <div className="px-5 py-4 sm:px-6">
                <CardHeader title="Recent applications" />
              </div>
              {data.applications.length > 0 ? (
                <>
                  <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                    {data.applications.slice(0, 5).map((a) => (
                      <ApplicationRow key={a.id} application={a} />
                    ))}
                  </ul>
                  <div className="border-t border-ink-950/10 px-5 py-3 sm:px-6">
                    <Button as={Link} to="/applications" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                      View all applications
                    </Button>
                  </div>
                </>
              ) : (
                <p className="border-t border-ink-950/10 px-5 py-6 text-center text-sm text-ink-600 sm:px-6">
                  No applications yet.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Quick actions" />
              <div className="mt-4 space-y-2">
                {[
                  { to: '/jobs/new', label: 'Post new job', icon: BriefcaseIcon },
                  { to: '/applications', label: 'Review applications', icon: DocumentTextIcon },
                  { to: '/events/new', label: 'Schedule event', icon: CalendarIcon }
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

      {!loading && tab === 'jobs' && (
        <Card padded={false}>
          <div className="px-5 py-4 sm:px-6">
            <CardHeader
              title="All job postings"
              actions={
                <Button as={Link} to="/jobs/new" size="sm" icon={PlusIcon}>
                  Post new job
                </Button>
              }
            />
          </div>
          {data.jobs.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {data.jobs.map((job) => (
                <JobRow key={job.id} job={job} showOrganization />
              ))}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <NoJobs />
            </div>
          )}
        </Card>
      )}

      {!loading && tab === 'applications' && (
        <Card padded={false}>
          <div className="px-5 py-4 sm:px-6">
            <CardHeader title="All applications" />
          </div>
          {data.applications.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {data.applications.map((a) => (
                <ApplicationRow key={a.id} application={a} showOrganization />
              ))}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <EmptyState
                icon={DocumentTextIcon}
                title="No applications yet"
                description="Applications appear here once candidates start applying to your jobs."
                action={
                  <Button as={Link} to="/jobs/new" icon={PlusIcon}>
                    Post a job
                  </Button>
                }
              />
            </div>
          )}
        </Card>
      )}

      {!loading && tab === 'candidates' && (
        <>
          {data.candidates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.candidates.map((candidate) => (
                <CandidateCard key={candidate.id} student={candidate} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UserGroupIcon}
              title="No candidates yet"
              description="Candidates from the institutions you have access to appear here as they complete their profiles."
              action={
                <Button as={Link} to="/jobs/new" icon={PlusIcon}>
                  Post a job
                </Button>
              }
            />
          )}
        </>
      )}

      {!loading && tab === 'events' && (
        <Card padded={false}>
          <div className="px-5 py-4 sm:px-6">
            <CardHeader
              title="Upcoming events"
              actions={
                <Button as={Link} to="/events/new" size="sm" icon={PlusIcon}>
                  Schedule event
                </Button>
              }
            />
          </div>
          {data.events.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-bone-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-ink-950">{event.title}</h3>
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
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                      <UserGroupIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="tabular-nums">{toInt(event.registrationCount)} registered</span>
                      {event.maxParticipants ? ` · max ${event.maxParticipants}` : ''}
                    </p>
                  </div>
                  <Button as={Link} to={`/events/${event.id}`} size="sm" variant="secondary">
                    View details
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <EmptyState
                icon={CalendarIcon}
                title="No upcoming events"
                description="Schedule a drive or a talk to get in front of candidates."
                action={
                  <Button as={Link} to="/events/new" icon={PlusIcon}>
                    Schedule an event
                  </Button>
                }
              />
            </div>
          )}
        </Card>
      )}

      {!loading && data.applications.length > 0 && (
        <Card className="mt-8">
          <CardHeader
            title="Application pipeline"
            description="Where your 10 most recent applications currently sit."
          />
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {pipeline.map((stage) => (
              <div
                key={stage.status}
                className={cx(
                  'rounded-xl border border-ink-950/15 px-3 py-4 text-center',
                  stage.count > 0 ? 'bg-bone-100' : 'bg-white'
                )}
              >
                <p className="font-display text-2xl font-bold tabular-nums text-ink-950">{stage.count}</p>
                <p className="mt-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
                  {stage.status}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default RecruiterDashboard;
