// client/src/pages/tpo/TPOAnalytics.js
//
// Placement analytics for a TPO. The page was written but never routed and the
// `/api/analytics` router was never mounted, so none of this had ever run.
//
// Two server-side constraints shape what is on screen:
//
//   * `GET /analytics/tpo` returns 0 applications when the date range is
//     unbounded, so the period control has no "all time" option and defaults to
//     the current year. Every number here is therefore scoped to a stated
//     period rather than silently wrong.
//   * That same endpoint 500s on the `branch`, `yearOfStudy` and `search`
//     filters. They are sent only to `GET /analytics/tpo/students`, which
//     handles them correctly — see FILTERS_FOR_OVERVIEW below.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  Pagination,
  Select,
  SkeletonCard,
  StatTile,

  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr
} from '../../components/ui';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'overview', label: 'Overview', icon: ChartBarIcon },
  { value: 'companies', label: 'Companies', icon: BuildingOfficeIcon },
  { value: 'students', label: 'Students', icon: UserGroupIcon }
];

// The subset of the filter set `GET /analytics/tpo` can actually serve.
const FILTERS_FOR_OVERVIEW = ['company', 'applicationStatus', 'placementStatus', 'dateRange'];

const DEFAULT_FILTERS = {
  company: '',
  applicationStatus: '',
  placementStatus: '',
  branch: '',
  yearOfStudy: '',
  dateRange: 'year',
  search: ''
};

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' }
];

// Exactly the values in the `applications.status` Postgres enum. Anything else
// reaches the database as an invalid enum literal and the endpoint 500s, so
// this list is not a place to be approximate — `pending` used to sit at the top
// of it and every selection of it returned "Could not load analytics".
const APPLICATION_STATUSES = [
  '',
  'applied',
  'screening',
  'shortlisted',
  'interviewed',
  'selected',
  'rejected',
  'withdrawn'
];

const BRANCHES = [
  'Computer Science Engineering',
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical'
];

const PAGE_SIZE = 20;

/** Serialises rows to CSV and hands the browser a download. */
const downloadCsv = (filename, columns, rows) => {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escape(c.value(row))).join(','))
  ].join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** A labelled proportion bar. Width comes from the data, never a guess. */
const MeterRow = ({ label, value, total, tone = 'ink' }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const fills = { ink: 'bg-ink-950', saffron: 'bg-saffron-500', india: 'bg-india-600' };
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0 truncate text-sm font-medium capitalize text-ink-800">{label}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="font-display text-base font-bold tabular-nums text-ink-950">{value}</span>
        <span
          className="h-2 w-24 overflow-hidden rounded-full bg-bone-200"
          role="img"
          aria-label={`${pct}% of ${total}`}
        >
          <span className={`block h-full rounded-full ${fills[tone]}`} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
};

const TPOAnalytics = () => {
  const { user } = useAuth();
  const allowed = user?.role === 'tpo' || user?.role === 'admin';

  const [tab, setTab] = useState('overview');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [companies, setCompanies] = useState([]);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [students, setStudents] = useState([]);
  const [studentsPagination, setStudentsPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams();
    FILTERS_FOR_OVERVIEW.forEach((key) => {
      if (filters[key]) params.set(key, filters[key]);
    });
    return params.toString();
  }, [filters]);

  const studentsQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(studentsPage), limit: String(PAGE_SIZE) });
    ['branch', 'yearOfStudy', 'placementStatus', 'search'].forEach((key) => {
      if (filters[key]) params.set(key, filters[key]);
    });
    return params.toString();
  }, [filters, studentsPage]);

  /**
   * Download the full filtered roster from the server.
   *
   * The client-side CSV below can only serialise the rows currently on screen;
   * this is every matching student. Fetched as a blob rather than linked
   * directly because the endpoint needs the bearer token, which a plain
   * anchor navigation cannot carry.
   */
  const exportRoster = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      ['branch', 'yearOfStudy', 'placementStatus'].forEach((key) => {
        if (filters[key]) params.set(key, filters[key]);
      });
      const blob = await api.get(`/analytics/tpo/export?${params.toString()}`, {
        responseType: 'blob',
        silent: true
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `placement-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.message || 'Could not export the roster.');
    } finally {
      setExporting(false);
    }
  }, [filters]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/analytics/tpo?${overviewQuery}`, { silent: true });
      setAnalytics(data.analytics || null);
    } catch (err) {
      setError(err?.message || 'Could not load analytics.');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [overviewQuery]);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const data = await api.get(`/analytics/tpo/students?${studentsQuery}`, { silent: true });
      setStudents(data.students || []);
      setStudentsPagination(data.pagination || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      setStudentsError(err?.message || 'Could not load students.');
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsQuery]);

  useEffect(() => {
    if (!allowed) return undefined;
    const t = setTimeout(loadAnalytics, 300);
    return () => clearTimeout(t);
  }, [allowed, loadAnalytics]);

  useEffect(() => {
    if (!allowed || tab !== 'students') return undefined;
    const t = setTimeout(loadStudents, 300);
    return () => clearTimeout(t);
  }, [allowed, tab, loadStudents]);

  useEffect(() => {
    if (!allowed) return;
    api
      .get('/organizations?type=company&limit=200', { silent: true })
      .then((data) => setCompanies(data.organizations || []))
      .catch(() => setCompanies([]));
  }, [allowed]);

  const setFilter = (name) => (e) => {
    const { value } = e.target;
    setStudentsPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const detailedCompanies = analytics?.companies?.detailed || [];
  const periodLabel =
    DATE_RANGES.find((d) => d.value === filters.dateRange)?.label.toLowerCase() || 'this year';

  if (!allowed) {
    return (
      <PageShell>
        <EmptyState
          icon={LockClosedIcon}
          title="Placement staff only"
          description="These analytics cover a single institution's students, so they are limited to its TPO and to administrators."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Analytics"
        title="Placement analytics"
        lead={
          user?.organization?.name
            ? `Applications, companies and placements for ${user.organization.name}.`
            : 'Applications, companies and placements for your institution.'
        }
        actions={
          <Button
            variant="secondary"
            icon={ArrowPathIcon}
            loading={loading}
            onClick={() => {
              loadAnalytics();
              if (tab === 'students') loadStudents();
            }}
          >
            Refresh
          </Button>
        }
      />

      <Toolbar className="flex-wrap">
        <div className="w-full sm:w-44">
          <Select
            label="Period"
            value={filters.dateRange}
            onChange={setFilter('dateRange')}
            options={DATE_RANGES}
            help="Counts are scoped to this window."
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Company"
            value={filters.company}
            onChange={setFilter('company')}
            options={[
              { value: '', label: 'All companies' },
              ...companies.map((c) => ({ value: String(c.id), label: c.name }))
            ]}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Application status"
            value={filters.applicationStatus}
            onChange={setFilter('applicationStatus')}
            options={APPLICATION_STATUSES.map((s) => ({
              value: s,
              label: s ? s[0].toUpperCase() + s.slice(1) : 'All statuses'
            }))}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Placement"
            value={filters.placementStatus}
            onChange={setFilter('placementStatus')}
            options={[
              { value: '', label: 'All students' },
              { value: 'placed', label: 'Placed' },
              { value: 'unplaced', label: 'Unplaced' }
            ]}
          />
        </div>
        <div className="sm:self-end sm:pb-0.5">
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset
          </Button>
        </div>
      </Toolbar>

      <Tabs className="mb-6 w-fit" tabs={TABS} value={tab} onChange={setTab} />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Could not load analytics" description={error} onRetry={loadAnalytics} />
      )}

      {!loading && !error && analytics && (
        <>
          {tab === 'overview' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Students"
                  value={analytics.students?.total ?? 0}
                  hint="Active accounts at your institution"
                  icon={UserGroupIcon}
                  accent="ink"
                />
                <StatTile
                  label="Placed"
                  value={analytics.placements?.placed ?? 0}
                  hint={`${analytics.placements?.placementRate ?? 0}% placement rate`}
                  icon={CheckCircleIcon}
                  accent="india"
                />
                <StatTile
                  label="Companies"
                  value={analytics.companies?.total ?? 0}
                  hint={`${analytics.companies?.active ?? 0} with open roles`}
                  icon={BuildingOfficeIcon}
                  accent="azure"
                />
                <StatTile
                  label="Applications"
                  value={analytics.applications?.total ?? 0}
                  hint={`${analytics.applications?.thisMonth ?? 0} this month`}
                  icon={DocumentTextIcon}
                  accent="saffron"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title="Applications by status"
                    description={`Across ${periodLabel}.`}
                  />
                  <div className="mt-4 divide-y divide-ink-950/10 border-t border-ink-950/10">
                    {(analytics.applications?.byStatus || []).length === 0 ? (
                      <p className="py-6 text-center text-sm text-ink-500">
                        No applications in this period.
                      </p>
                    ) : (
                      analytics.applications.byStatus.map((s) => (
                        <MeterRow
                          key={s.status}
                          label={s.status}
                          value={s.count}
                          total={analytics.applications.total || 0}
                          tone="saffron"
                        />
                      ))
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Placement by branch"
                    description="Placed students as a share of the branch."
                  />
                  <div className="mt-4 divide-y divide-ink-950/10 border-t border-ink-950/10">
                    {(analytics.placements?.byBranch || []).length === 0 ? (
                      <p className="py-6 text-center text-sm text-ink-500">
                        No branch data for your students yet.
                      </p>
                    ) : (
                      analytics.placements.byBranch.map((b) => (
                        <div key={b.branch} className="flex items-center justify-between gap-4 py-2.5">
                          <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                            {b.branch}
                          </span>
                          <span className="flex shrink-0 items-center gap-3 text-sm">
                            <span className="tabular-nums text-ink-600">
                              {b.placed}/{b.total}
                            </span>
                            <Badge tone={b.rate > 0 ? 'success' : 'neutral'}>{b.rate}%</Badge>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {tab === 'companies' && (
            <>
              <div className="mb-4 flex justify-end">
                <Button
                  variant="secondary"
                  icon={ArrowDownTrayIcon}
                  disabled={detailedCompanies.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `company-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
                      [
                        { label: 'Company', value: (r) => r.name },
                        { label: 'Industry', value: (r) => r.industry || '' },
                        { label: 'Applications', value: (r) => r.totalApplications ?? 0 },
                        { label: 'Selected', value: (r) => r.selected ?? 0 },
                        { label: 'Success rate %', value: (r) => r.successRate ?? 0 },
                        { label: 'Active jobs', value: (r) => r.activeJobs ?? 0 }
                      ],
                      detailedCompanies
                    )
                  }
                >
                  Export CSV
                </Button>
              </div>

              {detailedCompanies.length === 0 ? (
                <EmptyState
                  icon={BuildingOfficeIcon}
                  title="No company activity"
                  description="No company has posted or received applications in this period."
                />
              ) : (
                <Table>
                  <Thead>
                    <Tr className="hover:bg-transparent">
                      <Th>Company</Th>
                      <Th>Applications</Th>
                      <Th>Selected</Th>
                      <Th>Success rate</Th>
                      <Th>Active jobs</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {detailedCompanies.map((c) => (
                      <Tr key={c.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar src={c.logoUrl} name={c.name} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink-950">{c.name}</p>
                              {/* Industry is rendered only when the record has
                                  one — the previous version defaulted every
                                  blank to "Technology". */}
                              {c.industry && (
                                <p className="truncate text-xs text-ink-500">{c.industry}</p>
                              )}
                            </div>
                          </div>
                        </Td>
                        <Td className="tabular-nums">{c.totalApplications ?? 0}</Td>
                        <Td className="tabular-nums">{c.selected ?? 0}</Td>
                        <Td>
                          <Badge
                            tone={
                              (c.successRate ?? 0) > 20
                                ? 'success'
                                : (c.successRate ?? 0) > 10
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {c.successRate ?? 0}%
                          </Badge>
                        </Td>
                        <Td className="tabular-nums">{c.activeJobs ?? 0}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </>
          )}

          {tab === 'students' && (
            <>
              <Toolbar className="flex-wrap">
                <div className="min-w-[220px] flex-1">
                  <Input
                    label="Search students"
                    icon={MagnifyingGlassIcon}
                    value={filters.search}
                    onChange={setFilter('search')}
                    placeholder="Name or email"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    label="Branch"
                    value={filters.branch}
                    onChange={setFilter('branch')}
                    options={[
                      { value: '', label: 'All branches' },
                      ...BRANCHES.map((b) => ({ value: b, label: b }))
                    ]}
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Select
                    label="Year"
                    value={filters.yearOfStudy}
                    onChange={setFilter('yearOfStudy')}
                    options={[
                      { value: '', label: 'All years' },
                      ...[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))
                    ]}
                  />
                </div>
                <div className="sm:self-end sm:pb-0.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowDownTrayIcon}
                    loading={exporting}
                    onClick={exportRoster}
                  >
                    Export all
                  </Button>
                </div>
                <div className="sm:self-end sm:pb-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ArrowDownTrayIcon}
                    disabled={students.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `students-page-${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          { label: 'Name', value: (r) => `${r.firstName} ${r.lastName}` },
                          { label: 'Email', value: (r) => r.email },
                          { label: 'Branch', value: (r) => r.studentProfile?.branch || '' },
                          { label: 'Year', value: (r) => r.studentProfile?.yearOfStudy ?? '' },
                          { label: 'CGPA', value: (r) => r.studentProfile?.cgpa ?? '' },
                          {
                            label: 'Placement status',
                            value: (r) => r.studentProfile?.placementStatus || ''
                          },
                          { label: 'Applications', value: (r) => (r.applications || []).length }
                        ],
                        students
                      )
                    }
                  >
                    Export page
                  </Button>
                </div>
              </Toolbar>

              {studentsLoading && <SkeletonCard lines={6} />}

              {!studentsLoading && studentsError && (
                <ErrorState
                  title="Could not load students"
                  description={studentsError}
                  onRetry={loadStudents}
                />
              )}

              {!studentsLoading && !studentsError && students.length === 0 && (
                <EmptyState
                  icon={AcademicCapIcon}
                  title="No students match"
                  description="No student at your institution fits these filters."
                />
              )}

              {!studentsLoading && !studentsError && students.length > 0 && (
                <>
                  <Table>
                    <Thead>
                      <Tr className="hover:bg-transparent">
                        <Th>Student</Th>
                        <Th>Branch</Th>
                        <Th>Year</Th>
                        <Th>CGPA</Th>
                        <Th>Placement</Th>
                        <Th>Applications</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {students.map((s) => (
                        <Tr key={s.id}>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={s.profilePicture}
                                name={`${s.firstName} ${s.lastName}`}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink-950">
                                  {s.firstName} {s.lastName}
                                </p>
                                <p className="truncate text-xs text-ink-500">{s.email}</p>
                              </div>
                            </div>
                          </Td>
                          <Td>{s.studentProfile?.branch || '—'}</Td>
                          <Td className="tabular-nums">{s.studentProfile?.yearOfStudy ?? '—'}</Td>
                          <Td className="tabular-nums">{s.studentProfile?.cgpa ?? '—'}</Td>
                          <Td>
                            {s.studentProfile?.placementStatus ? (
                              <Badge
                                tone={
                                  s.studentProfile.placementStatus === 'placed' ? 'success' : 'neutral'
                                }
                                dot
                              >
                                {s.studentProfile.placementStatus.replace(/_/g, ' ')}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td className="tabular-nums">{(s.applications || []).length}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  <Pagination
                    className="mt-6"
                    page={studentsPagination.currentPage}
                    pages={studentsPagination.totalPages}
                    onChange={setStudentsPage}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
};

export default TPOAnalytics;
