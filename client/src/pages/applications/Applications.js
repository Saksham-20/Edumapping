// client/src/pages/applications/Applications.js
//
// The applications list, in two guises: a student's own tracker, and the
// reviewer queue for recruiters/TPOs/admins (checkbox selection, per-row and
// bulk status changes). Filtering and search are both server-side, so the page
// never has to hold more than one page of rows.
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  Pagination,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  StatusBadge
} from '../../components/ui';
import {
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const STUDENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Under review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' }
];

const REVIEWER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'applied', label: 'New applications' },
  { value: 'screening', label: 'Under review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' }
];

// The statuses a reviewer may move an application into, per row and in bulk.
const ROW_STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' }
];

const BULK_ACTION_OPTIONS = [
  { value: '', label: 'Bulk actions…' },
  { value: 'screening', label: 'Move to screening' },
  { value: 'shortlisted', label: 'Shortlist' },
  { value: 'interviewed', label: 'Mark as interviewed' },
  { value: 'selected', label: 'Select' },
  { value: 'rejected', label: 'Reject' }
];

const Applications = () => {
  const { user } = useAuth();
  const isStudent = user.role === 'student';

  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({ status: '', jobId: '', search: '' });
  // The search box updates on every keystroke; `filters.search` only catches up
  // after the debounce, and only that one drives the request.
  const [searchDraft, setSearchDraft] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => (prev.search === searchDraft ? prev : { ...prev, search: searchDraft }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const fetchApplications = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
        });

        const response = await api.get(`/applications?${params}`);
        setApplications(response.applications || []);
        setPagination(response.pagination || {});
      } catch (error) {
        toast.error('Failed to load applications');
        setApplications([]);
        setPagination({});
      } finally {
        setIsLoading(false);
      }
    },
    [filters]
  );

  const fetchJobs = useCallback(async () => {
    try {
      const response = await api.get('/jobs?limit=100');
      setJobs(response.jobs || []);
    } catch (error) {
      // The job filter is a convenience; the list still works without it.
    }
  }, []);

  useEffect(() => {
    // Any filter change resets to page 1 — page 3 of the old result set is
    // meaningless against the new one.
    fetchApplications(1);
  }, [fetchApplications]);

  useEffect(() => {
    if (!isStudent) fetchJobs();
  }, [isStudent, fetchJobs]);

  const handleStatusUpdate = async (applicationId, newStatus) => {
    try {
      await api.patch(`/applications/${applicationId}/status`, { status: newStatus });
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: newStatus } : app))
      );
      toast.success('Application status updated successfully');
    } catch (error) {
      toast.error('Failed to update application status');
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedApplications.length === 0) {
      toast.error('Please select applications to update');
      return;
    }

    try {
      await api.patch('/applications/bulk/update', {
        applicationIds: selectedApplications,
        status: newStatus
      });

      setApplications((prev) =>
        prev.map((app) =>
          selectedApplications.includes(app.id) ? { ...app, status: newStatus } : app
        )
      );

      toast.success(`${selectedApplications.length} applications updated successfully`);
      setSelectedApplications([]);
    } catch (error) {
      toast.error('Failed to update applications');
    }
  };

  const handleWithdrawApplication = async (applicationId) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;

    try {
      await api.patch(`/applications/${applicationId}/withdraw`);
      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, status: 'withdrawn' } : app))
      );
      toast.success('Application withdrawn successfully');
    } catch (error) {
      toast.error('Failed to withdraw application');
    }
  };

  const clearFilters = () => {
    setSearchDraft('');
    setFilters({ status: '', jobId: '', search: '' });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== '');

  const ApplicationCard = ({ application }) => {
    const profile = application.student?.studentProfile;
    return (
      <Card>
        <div className="flex items-start gap-4">
          {!isStudent && (
            <Checkbox
              className="pt-1"
              label={
                <span className="sr-only">
                  Select application from {application.student?.firstName}{' '}
                  {application.student?.lastName}
                </span>
              }
              checked={selectedApplications.includes(application.id)}
              onChange={(e) => {
                setSelectedApplications((prev) =>
                  e.target.checked
                    ? [...prev, application.id]
                    : prev.filter((id) => id !== application.id)
                );
              }}
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-ink-950">
                {isStudent ? (
                  <BuildingOfficeIcon
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-ink-500"
                    strokeWidth={1.8}
                  />
                ) : (
                  <UserIcon
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-ink-500"
                    strokeWidth={1.8}
                  />
                )}
                <span className="truncate">
                  {isStudent
                    ? application.job?.title
                    : `${application.student?.firstName || ''} ${
                        application.student?.lastName || ''
                      }`.trim() || 'Unknown applicant'}
                </span>
              </h3>
              <StatusBadge status={application.status} />
            </div>

            <div className="mt-3 space-y-1 text-sm text-ink-600">
              {isStudent ? (
                <>
                  <p>{application.job?.organization?.name}</p>
                  <p>Location: {application.job?.location || 'Not specified'}</p>
                  <p>Type: {application.job?.jobType?.replace('_', ' ') || 'Not specified'}</p>
                </>
              ) : (
                <>
                  <p>
                    Applied for:{' '}
                    <span className="font-medium text-ink-800">{application.job?.title}</span>
                  </p>
                  <p>{application.student?.email}</p>
                  {profile && (
                    <>
                      <p>
                        Course: {profile.course} · {profile.branch}
                      </p>
                      <p>
                        CGPA: {profile.cgpa || 'Not provided'} · Year: {profile.yearOfStudy}
                      </p>
                      {profile.skills?.length > 0 && (
                        <p>Skills: {profile.skills.slice(0, 3).join(', ')}</p>
                      )}
                    </>
                  )}
                </>
              )}

              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  Applied {new Date(application.appliedAt).toLocaleDateString()}
                </span>
                {application.shortlistedAt && (
                  <span>
                    Shortlisted {new Date(application.shortlistedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>

            {application.coverLetter && (
              <p className="mt-3 line-clamp-2 text-sm text-ink-700">
                <span className="font-medium text-ink-950">Cover letter:</span>{' '}
                {application.coverLetter}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-950/10 pt-4">
              <Button
                as={Link}
                to={`/applications/${application.id}`}
                size="sm"
                variant="secondary"
                icon={EyeIcon}
              >
                View details
              </Button>

              {!isStudent && (
                <Select
                  className="min-h-[36px] py-1.5 text-xs"
                  aria-label={`Change status for application ${application.id}`}
                  value={application.status}
                  onChange={(e) => handleStatusUpdate(application.id, e.target.value)}
                  options={ROW_STATUS_OPTIONS}
                />
              )}

              {isStudent && ['applied', 'screening'].includes(application.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleWithdrawApplication(application.id)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Pipeline"
        title={isStudent ? 'My applications' : 'Applications'}
        lead={
          isStudent
            ? 'Track the status of your job applications.'
            : 'Review and manage candidate applications.'
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Search applications"
            type="search"
            icon={MagnifyingGlassIcon}
            placeholder={isStudent ? 'Job title or company' : 'Applicant, job title, or company'}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="sm:min-w-[18rem]"
          />
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              icon={FunnelIcon}
              aria-expanded={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-sm text-ink-600 sm:ml-auto sm:pb-2.5" aria-live="polite">
            {pagination.totalItems ?? applications.length} applications
          </p>
        </div>

        {showFilters && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-950/10 pt-5 md:grid-cols-3">
            <Select
              label="Status"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              options={isStudent ? STUDENT_STATUS_OPTIONS : REVIEWER_STATUS_OPTIONS}
            />
            {!isStudent && (
              <Select
                label="Job position"
                value={filters.jobId}
                onChange={(e) => setFilters((prev) => ({ ...prev, jobId: e.target.value }))}
                options={[
                  { value: '', label: 'All positions' },
                  ...jobs.map((job) => ({ value: String(job.id), label: job.title }))
                ]}
              />
            )}
          </div>
        )}

        {!isStudent && selectedApplications.length > 0 && (
          <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-ink-950/10 pt-4">
            <span className="pb-2.5 text-sm font-medium text-ink-800">
              {selectedApplications.length} selected
            </span>
            <Select
              label="Apply to selection"
              className="sm:max-w-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) handleBulkStatusUpdate(e.target.value);
              }}
              options={BULK_ACTION_OPTIONS}
            />
            <Button
              variant="ghost"
              className="mb-0.5"
              onClick={() => setSelectedApplications([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : applications.length > 0 ? (
        <>
          <div className="space-y-4">
            {applications.map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))}
          </div>

          <Pagination
            className="mt-8"
            page={pagination.currentPage}
            pages={pagination.totalPages}
            onChange={fetchApplications}
          />
        </>
      ) : (
        <EmptyState
          icon={DocumentTextIcon}
          title="No applications found"
          description={
            hasActiveFilters
              ? 'Nothing matches this search. Clear the filters to see everything.'
              : isStudent
              ? "You haven't applied to any jobs yet. Start browsing available positions."
              : 'No one has applied to your postings yet.'
          }
          action={
            hasActiveFilters ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button as={Link} to="/jobs">
                Browse jobs
              </Button>
            )
          }
        />
      )}
    </PageShell>
  );
};

export default Applications;
