// client/src/pages/jobs/JobsList.js
//
// The job board. Server-paginated and server-filtered: every control here
// writes to the URL query string, and the URL is the single source of truth for
// what the list shows — so a filtered view is shareable and survives a reload.
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Pagination,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  StatusBadge,
  cx
} from '../../components/ui';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  MapPinIcon,
  BanknotesIcon,
  CalendarIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

const EMPTY_FILTERS = {
  search: '',
  jobType: '',
  location: '',
  salaryMin: '',
  salaryMax: '',
  experienceRequired: ''
};

// Chip labels for the active-filter row: the raw state keys ("salaryMin") are
// not something to show a user.
const FILTER_LABELS = {
  search: 'Search',
  jobType: 'Type',
  location: 'Location',
  salaryMin: 'Min salary',
  salaryMax: 'Max salary',
  experienceRequired: 'Experience'
};

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'internship', label: 'Internship' }
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any experience' },
  { value: '0', label: 'Entry level (0 years)' },
  { value: '1', label: '1+ years' },
  { value: '2', label: '2+ years' },
  { value: '3', label: '3+ years' },
  { value: '5', label: '5+ years' }
];

const formatSalary = (min, max) => {
  if (!min && !max) return 'Not disclosed';
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min) return `${min.toLocaleString()}+`;
  return `Up to ${max.toLocaleString()}`;
};

const getTimeAgo = (date) => {
  const diffInDays = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  return `${Math.floor(diffInDays / 30)} months ago`;
};

/** One metadata line item — icon plus value, muted. */
const Meta = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} />
    {children}
  </span>
);

const JobsList = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    jobType: searchParams.get('jobType') || '',
    location: searchParams.get('location') || '',
    salaryMin: searchParams.get('salaryMin') || '',
    salaryMax: searchParams.get('salaryMax') || '',
    experienceRequired: searchParams.get('experienceRequired') || ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchJobs = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '12',
          // Read the committed filters off the URL, not the draft state the
          // filter panel is editing: typing in the search box must not
          // silently change what the next page request asks for.
          ...Object.fromEntries(
            Array.from(searchParams.entries()).filter(([, value]) => value !== '')
          )
        });

        const response = await api.get(`/jobs?${params}`);
        setJobs(response.jobs || []);
        setPagination(response.pagination || {});
      } catch (error) {
        // The shared axios interceptor has already toasted; fall back to the
        // empty state rather than leaving the previous page's results on screen.
        setJobs([]);
        setPagination({});
      } finally {
        setIsLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const updateFilters = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);

    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateFilters({ search: filters.search });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchParams({});
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingJobId(jobId);
      await api.delete(`/jobs/${jobId}`);
      toast.success('Job deleted successfully');
      setJobs((prevJobs) => prevJobs.filter((job) => job.id !== jobId));

      // Deleting the only row on a trailing page would leave an empty view;
      // step back a page instead.
      if (jobs.length === 1 && pagination.currentPage > 1) {
        fetchJobs(pagination.currentPage - 1);
      }
    } catch (error) {
      toast.error('Failed to delete job');
    } finally {
      setDeletingJobId(null);
    }
  };

  const canManageJob = (job) =>
    user &&
    ['recruiter', 'admin', 'tpo'].includes(user.role) &&
    job.organizationId === user.organizationId;

  const activeFilters = Object.entries(filters).filter(([, value]) => value !== '');

  const JobCard = ({ job }) => {
    const manageable = canManageJob(job);
    return (
      <Card className="flex flex-col">
        <div className="flex items-center gap-2.5">
          {job.organization?.logoUrl ? (
            <img
              src={job.organization.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border border-ink-950/15 object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-950/15 bg-bone-100 text-ink-600"
            >
              <BuildingOfficeIcon className="h-4 w-4" strokeWidth={1.8} />
            </span>
          )}
          <span className="min-w-0 truncate text-sm font-medium text-ink-700">
            {job.organization?.name || 'Unknown organization'}
          </span>
        </div>

        <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-ink-950">
          <Link
            to={`/jobs/${job.id}`}
            className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
          >
            {job.title}
          </Link>
        </h3>

        {job.description && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-600">{job.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {job.location && <Meta icon={MapPinIcon}>{job.location}</Meta>}
          {(job.salaryMin || job.salaryMax) && (
            <Meta icon={BanknotesIcon}>{formatSalary(job.salaryMin, job.salaryMax)}</Meta>
          )}
          <Meta icon={CalendarIcon}>{getTimeAgo(job.createdAt)}</Meta>
          {/* Views and applicant counts are only meaningful to whoever owns the
              posting; a student has no use for them. */}
          {manageable && <Meta icon={EyeIcon}>{job.viewCount || 0} views</Meta>}
          {manageable && <Meta icon={UsersIcon}>{job.applicationCount || 0} applied</Meta>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{job.jobType?.replace('_', ' ') || 'unspecified'}</Badge>
          {manageable && job.status && <StatusBadge status={job.status} />}
          {job.applicationDeadline && (
            <span className="text-xs font-medium text-saffron-800">
              Closes {new Date(job.applicationDeadline).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-950/10 pt-4">
          <Button as={Link} to={`/jobs/${job.id}`} size="sm" variant="secondary">
            View details
          </Button>
          {manageable && (
            <>
              <Button
                as={Link}
                to={`/jobs/${job.id}/edit`}
                size="sm"
                variant="secondary"
                icon={PencilIcon}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={TrashIcon}
                loading={deletingJobId === job.id}
                onClick={() => handleDeleteJob(job.id)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Opportunities"
        title={user?.role === 'student' ? 'Find your next role' : 'Job listings'}
        lead="Discover opportunities that match your skills and interests."
        actions={
          user &&
          ['recruiter', 'tpo'].includes(user.role) && (
            <Button as={Link} to="/jobs/new" icon={PlusIcon}>
              Post a job
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Search jobs"
            type="search"
            icon={MagnifyingGlassIcon}
            placeholder="Title, company, or skill"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="sm:min-w-[18rem]"
          />
          <div className="flex shrink-0 gap-2">
            <Button type="submit">Search</Button>
            <Button
              variant="secondary"
              icon={FunnelIcon}
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </div>
        </form>

        {showFilters && (
          <div className="mt-5 border-t border-ink-950/10 pt-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Job type"
                value={filters.jobType}
                onChange={(e) => handleFilterChange('jobType', e.target.value)}
                options={JOB_TYPE_OPTIONS}
              />
              <Input
                label="Location"
                placeholder="City, state"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              />
              <Input
                label="Minimum salary"
                type="number"
                min="0"
                placeholder="50000"
                value={filters.salaryMin}
                onChange={(e) => handleFilterChange('salaryMin', e.target.value)}
              />
              <Select
                label="Experience"
                value={filters.experienceRequired}
                onChange={(e) => handleFilterChange('experienceRequired', e.target.value)}
                options={EXPERIENCE_OPTIONS}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => updateFilters(filters)}>
                Apply filters
              </Button>
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          </div>
        )}

        {activeFilters.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-950/10 pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
              Active
            </span>
            {activeFilters.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-950/15 bg-bone-100 px-2.5 py-0.5 text-xs font-medium text-ink-700"
              >
                {FILTER_LABELS[key] || key}: {value}
                <button
                  type="button"
                  onClick={() => updateFilters({ [key]: '' })}
                  aria-label={`Remove ${FILTER_LABELS[key] || key} filter`}
                  className="rounded-full text-ink-500 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                >
                  <XMarkIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : (
        <>
          <p aria-live="polite" className="mb-5 text-sm text-ink-600">
            {pagination.totalJobs ?? jobs.length} jobs found
            {filters.search && ` for “${filters.search}”`}
          </p>

          {jobs.length > 0 ? (
            <>
              <div className={cx('grid gap-5 lg:grid-cols-2')}>
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>

              <Pagination
                className="mt-8"
                page={pagination.currentPage}
                pages={pagination.totalPages}
                onChange={fetchJobs}
              />
            </>
          ) : (
            <EmptyState
              icon={BriefcaseIcon}
              title="No jobs found"
              description={
                activeFilters.length > 0
                  ? 'Nothing matches these filters. Widen the search and try again.'
                  : 'There are no postings yet. Check back soon.'
              }
              action={
                activeFilters.length > 0 ? (
                  <Button onClick={clearFilters}>Clear filters</Button>
                ) : user && ['recruiter', 'tpo'].includes(user.role) ? (
                  <Button as={Link} to="/jobs/new" icon={PlusIcon}>
                    Post a job
                  </Button>
                ) : (
                  <Button as={Link} to="/dashboard" variant="secondary">
                    Back to dashboard
                  </Button>
                )
              }
            />
          )}
        </>
      )}
    </PageShell>
  );
};

export default JobsList;
