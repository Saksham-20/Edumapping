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
  Modal,
  Select,
  SkeletonCard,
  StatusBadge,
  Textarea
} from '../../components/ui';
import {
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
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

  // Bulk shortlisting by pasted roll numbers. The recruiter's reply arrives as
  // an Excel column, so the paste box is the primary affordance — matching it
  // row by row against the table is the job this replaces. `preview` holds the
  // server's dry-run report; nothing is written until it has been shown.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState('shortlisted');
  const [preview, setPreview] = useState(null);
  const [pasteBusy, setPasteBusy] = useState(false);

  // Raising an offer against one application. The package is what makes a
  // placement reportable, so it is asked for here rather than left to be filled
  // in later and never filled in.
  const [offerFor, setOfferFor] = useState(null);
  const [offerCtc, setOfferCtc] = useState('');
  const [offerPPO, setOfferPPO] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => (prev.search === searchDraft ? prev : { ...prev, search: searchDraft }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // Split on any of the separators a pasted column or a copied cell range can
  // carry — newlines, commas, tabs, semicolons — rather than assuming one.
  const parseIdentifiers = (text) =>
    String(text || '')
      .split(/[\s,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);

  const raiseOffer = async () => {
    setOfferBusy(true);
    try {
      await api.post('/offers', {
        applicationId: offerFor.id,
        ctc: offerCtc === '' ? null : Number(offerCtc),
        isPPO: offerPPO
      });
      toast.success('Offer raised');
      setOfferFor(null);
      setOfferPPO(false);
      fetchApplications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not raise the offer');
    } finally {
      setOfferBusy(false);
    }
  };

  const runPaste = async (dryRun) => {
    const identifiers = parseIdentifiers(pasteText);
    if (identifiers.length === 0) {
      toast.error('Paste at least one roll number or email address');
      return;
    }
    try {
      setPasteBusy(true);
      const res = await api.post(`/applications/job/${filters.jobId}/bulk-by-identifier`, {
        identifiers,
        status: pasteStatus,
        dryRun
      });
      if (dryRun) {
        setPreview(res);
      } else {
        toast.success(res.message);
        setPasteOpen(false);
        setPasteText('');
        setPreview(null);
        fetchApplications();
      }
    } catch (error) {
      // The interceptor stays quiet on 4xx here because this panel reports the
      // outcome itself; anything else it has already toasted.
      toast.error(error.response?.data?.message || 'Could not update those applications');
    } finally {
      setPasteBusy(false);
    }
  };

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

              {!isStudent && ['interviewed', 'shortlisted', 'selected'].includes(application.status) && (
                <Button
                  size="sm"
                  variant="saffron"
                  icon={BanknotesIcon}
                  onClick={() => { setOfferFor(application); setOfferCtc(''); }}
                >
                  Raise offer
                </Button>
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

        {!isStudent && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-950/10 pt-4">
            <Button
              variant="secondary"
              disabled={!filters.jobId}
              onClick={() => { setPreview(null); setPasteOpen(true); }}
            >
              <ClipboardDocumentListIcon aria-hidden="true" className="h-4 w-4" />
              Shortlist by roll number
            </Button>
            <span className="text-sm text-ink-500">
              {filters.jobId
                ? 'Paste the roll numbers or emails the recruiter sent back.'
                : 'Pick a single job above to paste a shortlist into it.'}
            </span>
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

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Shortlist by roll number"
        description="Paste roll numbers or email addresses, one per line. Preview first — anyone who cannot be matched is listed before anything changes."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" loading={pasteBusy} onClick={() => runPaste(true)}>
              Preview
            </Button>
            <Button
              variant="saffron"
              loading={pasteBusy}
              disabled={!preview || preview.matched === 0}
              onClick={() => runPaste(false)}
            >
              {preview ? `Move ${preview.matched} to ${pasteStatus}` : 'Preview first'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Roll numbers or emails"
            rows={7}
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPreview(null); }}
            placeholder={'TU2021001\nTU2021002\nalice.wilson@techuniversity.edu'}
            help="Separated by new lines, commas, tabs or semicolons. Duplicates and blank lines are ignored."
          />
          <Select
            label="Move matched applicants to"
            value={pasteStatus}
            onChange={(e) => { setPasteStatus(e.target.value); setPreview(null); }}
            options={BULK_ACTION_OPTIONS.filter((o) => o.value)}
          />

          {preview && (
            <div className="rounded-xl border border-ink-950/15 bg-bone-50 p-4">
              <p className="text-sm font-semibold text-ink-950">
                {preview.matched} of {preview.requested} will be moved to {pasteStatus}
              </p>
              {preview.details.notApplied.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Found, but never applied to this job ({preview.details.notApplied.length})
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    {preview.details.notApplied.map((n) => `${n.name} (${n.identifier})`).join(', ')}
                  </p>
                </div>
              )}
              {preview.details.unknown.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Matched nobody ({preview.details.unknown.length})
                  </p>
                  <p className="mt-1 text-sm text-ink-700">{preview.details.unknown.join(', ')}</p>
                </div>
              )}
              {preview.matched > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Will be updated ({preview.matched})
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    {preview.details.matched
                      .map((m) => `${m.name} (${m.currentStatus})`)
                      .join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(offerFor)}
        onClose={() => setOfferFor(null)}
        size="sm"
        title="Raise an offer"
        description={
          offerFor
            ? `For ${offerFor.student?.firstName} ${offerFor.student?.lastName}, against ${offerFor.job?.title}.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferFor(null)}>
              Cancel
            </Button>
            <Button variant="saffron" loading={offerBusy} onClick={raiseOffer}>
              Raise offer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Annual CTC (₹)"
            type="number"
            min="0"
            value={offerCtc}
            onChange={(e) => setOfferCtc(e.target.value)}
            placeholder="e.g. 1450000"
            help="Optional — some offers arrive before the number does. Without it the offer is recorded but cannot appear in salary statistics."
          />
          <Checkbox
            label="Pre-placement offer (PPO)"
            checked={offerPPO}
            onChange={(e) => setOfferPPO(e.target.checked)}
          />
          <p className="text-sm text-ink-600">
            The student is notified immediately and the application is marked selected.
          </p>
        </div>
      </Modal>
    </PageShell>
  );
};

export default Applications;
