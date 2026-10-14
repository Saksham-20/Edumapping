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
  Avatar,
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
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { formatJobType, formatSalary } from '../../utils/helpers';
import { readAllowedBranches, readGraduationYears, readMinCGPA, readNumeric } from '../../utils/eligibility';

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

// The API filters `experienceRequired <= value` — it answers "what can someone
// with N years apply to", not "what demands at least N years". The old "2+
// years" labels claimed the opposite of what the control does.
const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any experience' },
  { value: '0', label: 'No experience needed' },
  { value: '1', label: 'Up to 1 year needed' },
  { value: '2', label: 'Up to 2 years needed' },
  { value: '3', label: 'Up to 3 years needed' },
  { value: '5', label: 'Up to 5 years needed' }
];

/**
 * The moment a drive stops taking applications. `applicationDeadline` is a
 * plain date and the server closes it at 23:59 IST that day — reading it as
 * `new Date('2026-10-22')` would be 05:30 IST and call it closed all day.
 */
const deadlineCutoff = (deadline) => {
  if (!deadline) return null;
  const d = new Date(`${String(deadline).slice(0, 10)}T23:59:59+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDeadline = (deadline) =>
  new Date(`${String(deadline).slice(0, 10)}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

/** A value the student has actually filled in — null is "not filled", not 0. */
const filled = (value) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

// One branch, many spellings: a recruiter types "CSE, IT", the student's
// profile says "Computer Science Engineering". Same table as the server's
// utils/branches.js, so the preview agrees with the verdict at Apply. Two-letter
// codes that mean different branches at different universities ("CE") are
// deliberately absent.
const BRANCH_CANON = {
  'Computer Science Engineering': ['cse', 'cs', 'computerscience', 'computerscienceengineering', 'computerengineering', 'coe', 'comp'],
  'Information Technology': ['it', 'informationtechnology'],
  'Electronics and Communication Engineering': ['ece', 'ec', 'electronicscommunication', 'electronicscommunicationengineering', 'electronicstelecommunication', 'electronicstelecommunicationengineering', 'entc', 'extc'],
  'Electrical and Electronics Engineering': ['eee', 'electricalelectronics', 'electricalelectronicsengineering'],
  'Electrical Engineering': ['electrical', 'electricalengineering'],
  'Mechanical Engineering': ['mech', 'mechanical', 'mechanicalengineering'],
  'Civil Engineering': ['civil', 'civilengineering'],
  'Chemical Engineering': ['che', 'chemical', 'chemicalengineering'],
  'Artificial Intelligence and Data Science': ['aids', 'aiandds', 'ads', 'artificialintelligencedatascience'],
  'Artificial Intelligence and Machine Learning': ['aiml', 'artificialintelligencemachinelearning']
};
const BRANCH_ALIASES = Object.entries(BRANCH_CANON).reduce((acc, [label, keys]) => {
  keys.forEach((k) => {
    acc[k] = label;
  });
  return acc;
}, {});
const branchLabel = (branch) => {
  const raw = String(branch || '').trim();
  const key = raw
    .toLowerCase()
    .replace(/\bengg\b\.?|\bengg\./g, 'engineering')
    .replace(/&|\band\b/g, '')
    .replace(/[^a-z]/g, '');
  return BRANCH_ALIASES[key] || raw;
};

const sameBranch = (a, b) => {
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(branchLabel(a));
  const y = norm(branchLabel(b));
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

/**
 * The first reason this student does not meet a job's criteria, or null.
 *
 * Mirrors the server's check (utils/eligibility.js) so the board can say
 * "not eligible" before the student opens the job and taps Apply. The server
 * remains the judge; this is only the preview. A field the student has not
 * filled in never counts against them.
 */
const firstIneligibility = (criteria, sp) => {
  if (!criteria || !sp) return null;
  const minCgpa = readMinCGPA(criteria);
  if (minCgpa !== undefined && filled(sp.cgpa) && Number(sp.cgpa) < Number(minCgpa)) {
    return `Needs CGPA ${minCgpa}+ (yours is ${Number(sp.cgpa)})`;
  }
  const years = readGraduationYears(criteria).map(Number);
  if (years.length && filled(sp.graduationYear) && !years.includes(Number(sp.graduationYear))) {
    return `Open to the ${years.join(', ')} batch${years.length > 1 ? 'es' : ''}`;
  }
  const branches = readAllowedBranches(criteria);
  if (branches.length && sp.branch && !branches.some((b) => sameBranch(b, sp.branch))) {
    return `Open to ${branches.join(', ')}`;
  }
  const maxBacklogs = readNumeric(criteria, 'maxBacklogs', 'max_backlogs');
  if (maxBacklogs !== undefined && filled(sp.activeBacklogs) && Number(sp.activeBacklogs) > maxBacklogs) {
    return maxBacklogs === 0 ? 'Needs no active backlogs' : `Allows at most ${maxBacklogs} active backlogs`;
  }
  const min10 = readNumeric(criteria, 'minClass10Percentage', 'min_class10_percentage');
  if (min10 !== undefined && filled(sp.class10Percentage) && Number(sp.class10Percentage) < min10) {
    return `Needs ${min10}% in Class X`;
  }
  const min12 = readNumeric(criteria, 'minClass12Percentage', 'min_class12_percentage');
  if (min12 !== undefined && (filled(sp.class12Percentage) || filled(sp.diplomaPercentage))) {
    const best = Math.max(
      filled(sp.class12Percentage) ? Number(sp.class12Percentage) : -Infinity,
      filled(sp.diplomaPercentage) ? Number(sp.diplomaPercentage) : -Infinity
    );
    if (best < min12) return `Needs ${min12}% in Class XII or diploma`;
  }
  const maxGap = readNumeric(criteria, 'maxEducationGapYears', 'max_education_gap_years');
  if (maxGap !== undefined && filled(sp.educationGapYears) && Number(sp.educationGapYears) > maxGap) {
    return maxGap === 0 ? 'No gap in education allowed' : `Allows at most ${maxGap} years of gap`;
  }
  return null;
};

/** Annual CTC for a posting, read the way the server's policy check reads it. */
const jobCtc = (job) => {
  const v = Math.max(Number(job?.salaryMax) || 0, Number(job?.salaryMin) || 0);
  return v > 0 && v < 1000 ? v * 100000 : v;
};

/**
 * The placement cell's own bar on this student applying, or null — the same
 * rules as the server's utils/placementPolicy.js (verified profile, offer
 * cap, dream tiers). Without it a student who had to be verified first saw
 * "You meet the criteria" on every card and was refused at Apply.
 */
const policyBlock = (policy, job, sp, offers) => {
  if (!policy?.enabled) return null;
  if (policy.requireVerifiedProfile && sp && sp.verificationStatus !== 'verified') {
    return 'Get your academic details verified on your profile first';
  }
  const exempt =
    job.jobType === 'internship' || (policy.exemptJobIds || []).map(Number).includes(Number(job.id));
  const live = (offers || []).filter((o) => o.status === 'offered' || o.status === 'accepted');
  if (exempt || live.length === 0) return null;
  if (policy.blockAfterAcceptance && live.some((o) => o.status === 'accepted')) {
    return 'Closed to you after accepting an offer';
  }
  if (policy.maxOffers && live.length >= policy.maxOffers) {
    return `You already hold ${live.length} offers, the most your college allows`;
  }
  const best = Math.max(...live.map((o) => Number(o.ctc) || 0));
  const tiers = (policy.tiers || [])
    .map((t) => ({ name: t.name, minCtc: Number(t.minCtc) || 0 }))
    .filter((t) => t.name)
    .sort((a, b) => a.minCtc - b.minCtc);
  if (policy.placedRule === 'higher_tier' && tiers.length > 0) {
    const idx = (ctc) => tiers.reduce((acc, t, i) => (ctc >= t.minCtc ? i : acc), -1);
    if (idx(jobCtc(job)) <= idx(best)) return 'You can only apply to a higher tier than the offer you hold';
  } else if (policy.placedRule === 'ctc_multiplier' && Number(policy.ctcMultiplier) > 0) {
    if (jobCtc(job) < best * Number(policy.ctcMultiplier)) return 'Pays too little next to the offer you hold';
  }
  return null;
};

const getTimeAgo = (date) => {
  const diffInDays = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  const ago = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (diffInDays < 7) return ago(diffInDays, 'day');
  if (diffInDays < 30) return ago(Math.floor(diffInDays / 7), 'week');
  return ago(Math.floor(diffInDays / 30), 'month');
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
  const isStudent = user?.role === 'student';
  // For a student: their academic profile and the jobs they already applied
  // to, so each card can say "Applied", "Not eligible" or "Closed" up front
  // instead of only after they open it and tap Apply.
  const [studentProfile, setStudentProfile] = useState(null);
  const [myApplications, setMyApplications] = useState({});
  const [policy, setPolicy] = useState(null);
  const [myOffers, setMyOffers] = useState([]);

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    Promise.allSettled([
      api.get('/users/profile', { silent: true }),
      api.get('/applications', { params: { limit: 100 }, silent: true }),
      api.get('/placement/policy', { silent: true }),
      api.get('/offers', { params: { limit: 100 }, silent: true })
    ]).then(([profileRes, appsRes, policyRes, offersRes]) => {
      if (cancelled) return;
      if (profileRes.status === 'fulfilled') {
        setStudentProfile(profileRes.value?.user?.studentProfile || null);
      }
      if (appsRes.status === 'fulfilled') {
        const byJob = {};
        (appsRes.value?.applications || []).forEach((a) => {
          byJob[a.jobId] = a;
        });
        setMyApplications(byJob);
      }
      if (policyRes.status === 'fulfilled') setPolicy(policyRes.value?.policy || null);
      if (offersRes.status === 'fulfilled') setMyOffers(offersRes.value?.offers || []);
    });
    return () => {
      cancelled = true;
    };
  }, [isStudent]);

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
      // The api interceptor has already shown the server's reason.
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
    const cutoff = deadlineCutoff(job.applicationDeadline);
    const closed = Boolean(cutoff && cutoff < new Date());
    const daysLeft = cutoff && !closed ? Math.floor((cutoff - new Date()) / 86400000) : null;
    const application = isStudent ? myApplications[job.id] : null;
    const applied = application && application.status !== 'withdrawn';
    const ineligibleReason =
      isStudent && !applied && !closed
        ? policyBlock(policy, job, studentProfile, myOffers) ||
          firstIneligibility(job.eligibilityCriteria, studentProfile)
        : null;
    return (
      <Card className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <Avatar src={job.organization?.logoUrl} name={job.organization?.name || ''} size="sm" />
          <span className="min-w-0 truncate text-sm font-medium text-ink-700">
            {job.organization?.name || 'Unknown organization'}
          </span>
        </div>

        <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-ink-950">
          <Link
            to={`/jobs/${job.id}`}
            className="inline-block rounded py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
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
          {manageable && <Meta icon={EyeIcon}>{job.viewCount || 0} view{Number(job.viewCount) === 1 ? '' : 's'}</Meta>}
          {manageable && <Meta icon={UsersIcon}>{job.applicationCount || 0} applied</Meta>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{formatJobType(job.jobType) || 'Type not set'}</Badge>
          {manageable && job.status && <StatusBadge status={job.status} />}
          {closed ? (
            <>
              <Badge tone="neutral">Closed</Badge>
              <span className="text-xs text-ink-500">
                Applications closed {formatDeadline(job.applicationDeadline)}
              </span>
            </>
          ) : (
            job.applicationDeadline && (
              <span className="text-xs font-medium text-saffron-800">
                {daysLeft === 0
                  ? 'Last day to apply'
                  : daysLeft !== null && daysLeft < 3
                  ? `Closes in ${daysLeft + 1} days`
                  : `Apply by ${formatDeadline(job.applicationDeadline)}`}
              </span>
            )
          )}
        </div>

        {isStudent && (applied || application?.status === 'withdrawn' || ineligibleReason || (studentProfile && !closed)) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {applied ? (
              <>
                <span className="font-medium text-ink-700">You applied</span>
                <StatusBadge status={application.status} />
              </>
            ) : application?.status === 'withdrawn' ? (
              <span className="text-ink-600">
                You withdrew your application{closed ? '' : ' — you can apply again while the drive is open'}.
              </span>
            ) : ineligibleReason ? (
              <>
                <Badge tone="warning">Can’t apply</Badge>
                <span className="text-ink-600">{ineligibleReason}</span>
              </>
            ) : (
              <Badge tone="success">You meet the criteria</Badge>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-950/10 pt-4">
          <Button as={Link} to={`/jobs/${job.id}`} size="sm" variant="secondary">
            {isStudent && !closed && !applied && !ineligibleReason ? 'View and apply' : 'View details'}
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
            /* The API searches title, description and required skills. It does
               not join the organization, so promising "company" here sends
               people looking for an employer to an empty result set. */
            placeholder="Title, description, or skill"
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
            <span className="text-xs font-medium text-ink-500">Filtered by</span>
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
            {(() => {
              const n = pagination.totalJobs ?? jobs.length;
              return `${n} ${n === 1 ? 'job' : 'jobs'} found`;
            })()}
            {filters.search && ` for “${filters.search}”`}
          </p>

          {jobs.length > 0 ? (
            <>
              <div className={cx('grid gap-5 lg:grid-cols-2')}>
                {/* Closed drives sink to the end of the page: a student scanning
                    for something to apply to should meet the open ones first. */}
                {[...jobs]
                  .sort((a, b) => {
                    const closedA = (deadlineCutoff(a.applicationDeadline) || Infinity) < new Date();
                    const closedB = (deadlineCutoff(b.applicationDeadline) || Infinity) < new Date();
                    return Number(closedA) - Number(closedB);
                  })
                  .map((job) => (
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
