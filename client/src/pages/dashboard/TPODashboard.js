// client/src/pages/dashboard/TPODashboard.js
//
// The placement officer's overview. One endpoint (`/statistics/tpo`) returns
// every figure on this page, so there is nothing to fan out — but the page
// still owns its error and empty states rather than leaning on a toast.
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
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
  StatusBadge
} from '../../components/ui';
import {
  UserGroupIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartBarIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';

const EMPTY = { students: {}, jobs: {}, applications: {}, events: {}, recentActivity: [] };

const toInt = (v) => parseInt(v, 10) || 0;

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

/**
 * A labelled count with a proportion bar. `total` is the denominator the bar is
 * drawn against; a zero total renders an empty bar rather than dividing by one
 * and drawing a full bar for a count of zero.
 */
const DistributionRow = ({ label, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <span className="min-w-0 truncate text-sm font-medium capitalize text-ink-800">{label}</span>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-display text-base font-bold tabular-nums text-ink-950">{count}</span>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${count} of ${total}`}
          className="h-2 w-24 overflow-hidden rounded-full bg-bone-200"
        >
          <div className="h-full rounded-full bg-saffron-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </li>
  );
};

const TPODashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `silent` because this page renders an ErrorState with its own retry.
      const response = await api.get('/statistics/tpo', { silent: true });
      if (!response?.stats) throw new Error('The statistics response was empty.');
      setStats({ ...EMPTY, ...response.stats });
    } catch (err) {
      setStats(EMPTY);
      setError(err?.message || 'Could not load placement statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const students = stats.students || {};
  const jobs = stats.jobs || {};
  const applications = stats.applications || {};
  const events = stats.events || {};

  const placementByStatus = Array.isArray(students.byPlacementStatus) ? students.byPlacementStatus : [];
  const jobsByStatus = Array.isArray(jobs.byStatus) ? jobs.byStatus : [];
  const applicationsByStatus = Array.isArray(applications.byStatus) ? applications.byStatus : [];
  const byCompany = Array.isArray(applications.byCompany) ? applications.byCompany : [];
  const recentActivity = Array.isArray(stats.recentActivity) ? stats.recentActivity : [];

  const header = (
    <PageHeader
      eyebrow="Placement office"
      title={user?.organization?.name ? `${user.organization.name} placements` : 'Placement dashboard'}
      lead="Placement tracking, job pipeline and student activity for your institution."
      actions={
        <>
          <Button as={Link} to="/approvals" variant="secondary" icon={ClipboardDocumentCheckIcon}>
            Approvals
          </Button>
          <Button as={Link} to="/tpo/analytics" icon={ChartBarIcon}>
            Analytics
          </Button>
        </>
      }
    />
  );

  if (error && !loading) {
    return (
      <PageShell width="wide">
        {header}
        <ErrorState title="Could not load placement statistics" description={error} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      {header}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Students"
          value={toInt(students.total)}
          hint="Enrolled at your institution"
          icon={UserGroupIcon}
          loading={loading}
        />
        <StatTile
          label="Placed"
          value={toInt(students.placed)}
          hint={`${students.placementRate ?? 0}% placement rate`}
          icon={CheckCircleIcon}
          accent="india"
          loading={loading}
        />
        <StatTile
          label="Active jobs"
          value={toInt(jobs.active)}
          hint={`${toInt(jobs.total)} posted in total`}
          icon={BriefcaseIcon}
          accent="saffron"
          to="/jobs"
          loading={loading}
        />
        <StatTile
          label="Applications"
          value={toInt(applications.total)}
          hint="Submitted by your students"
          icon={DocumentTextIcon}
          accent="azure"
          to="/applications"
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Placement status" description="Students by placement outcome." />
              {placementByStatus.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink-950/10">
                  {placementByStatus.map((row) => (
                    <DistributionRow
                      key={row.placementStatus}
                      label={row.placementStatus || 'unplaced'}
                      count={toInt(row.count)}
                      total={toInt(students.total)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-600">No placement data available yet.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Job pipeline" description="Postings visible to your students." />
              {jobsByStatus.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink-950/10">
                  {jobsByStatus.map((row) => (
                    <DistributionRow
                      key={row.status}
                      label={row.status}
                      count={toInt(row.count)}
                      total={toInt(jobs.total)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-600">No job data available yet.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Application stages" description="Where your students' applications sit." />
              {applicationsByStatus.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink-950/10">
                  {applicationsByStatus.map((row) => (
                    <DistributionRow
                      key={row.status}
                      label={row.status}
                      count={toInt(row.count)}
                      total={toInt(applications.total)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-600">No application data available yet.</p>
              )}
            </Card>
          </div>

          <Card padded={false} className="mb-8">
            <div className="px-5 py-4 sm:px-6">
              <CardHeader
                title="Applications by company"
                description="Where your students are applying, most active first."
              />
            </div>
            {byCompany.length > 0 ? (
              <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                {byCompany.slice(0, 10).map((row, index) => (
                  <li
                    key={`${row.job?.id ?? 'unknown'}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-ink-950">
                        {row.job?.organization?.name || 'Unknown company'}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-600">{row.job?.title || 'Untitled role'}</p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-bold tabular-nums text-ink-950">
                      {toInt(row.count)}
                      <span className="ml-1.5 font-sans text-xs font-medium text-ink-500">applications</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-ink-950/10 p-5 sm:p-6">
                <EmptyState
                  icon={BuildingOfficeIcon}
                  title="No company applications yet"
                  description="Once your students apply, the companies they target appear here."
                  action={
                    <Button as={Link} to="/jobs" variant="secondary">
                      Browse jobs
                    </Button>
                  }
                />
              </div>
            )}
          </Card>

          <Card padded={false} className="mb-8">
            <div className="px-5 py-4 sm:px-6">
              <CardHeader
                title="Recent activity"
                actions={
                  <Button as={Link} to="/applications" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
                    All applications
                  </Button>
                }
              />
            </div>
            {recentActivity.length > 0 ? (
              <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
                {recentActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-ink-950">
                        {[activity.student?.firstName, activity.student?.lastName]
                          .filter(Boolean)
                          .join(' ') || 'Unknown student'}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-600">
                        Applied to {activity.job?.title || 'a role'}
                        {activity.job?.organization?.name ? ` at ${activity.job.organization.name}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {formatDate(activity.createdAt) && (
                        <span className="text-xs text-ink-500">{formatDate(activity.createdAt)}</span>
                      )}
                      <StatusBadge status={activity.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-ink-950/10 p-5 sm:p-6">
                <EmptyState
                  icon={DocumentTextIcon}
                  title="No recent activity"
                  description="Student applications show up here as they are submitted."
                />
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Quick actions" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    to: '/jobs/new',
                    icon: BriefcaseIcon,
                    title: 'Post new job',
                    description: 'Create a posting for your students'
                  },
                  {
                    to: '/events/new',
                    icon: CalendarIcon,
                    title: 'Schedule event',
                    description: 'Set up a drive, workshop or talk'
                  },
                  {
                    // Was /students, which has never existed as a route — the
                    // tile silently bounced to the landing page. The roster
                    // lives inside the analytics surface.
                    to: '/tpo/analytics',
                    icon: AcademicCapIcon,
                    title: 'Students & analytics',
                    description: 'Placement performance and student roster'
                  },
                  {
                    to: '/applications',
                    icon: DocumentTextIcon,
                    title: 'View applications',
                    description: 'Monitor every application'
                  }
                ].map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="flex items-start gap-3 rounded-2xl border border-ink-950/15 p-4 transition-colors hover:border-ink-950/40 hover:bg-bone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-950/15 bg-bone-100 text-ink-700"
                    >
                      <action.icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-bold text-ink-950">{action.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-600">{action.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>

            <StatTile
              label="Events"
              value={toInt(events.total)}
              hint="Scheduled by your institution"
              icon={CalendarIcon}
              to="/events"
            />
          </div>
        </>
      )}
    </PageShell>
  );
};

export default TPODashboard;
