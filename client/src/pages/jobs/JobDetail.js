// client/src/pages/jobs/JobDetail.js
//
// One job posting, plus the student apply flow. Applying is gated client-side
// on a complete profile and a generated resume — the server would accept the
// application either way, but a recruiter reading an empty profile is worse
// than a student being sent back to fill one in.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoundsManager from '../../components/rounds/RoundsManager';
import api from '../../services/api';
import {
  ACADEMIC_CRITERIA,
  readAllowedBranches,
  readGraduationYears,
  readMinCGPA,
  readNumeric
} from '../../utils/eligibility';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  PageShell,
  SkeletonCard,
  StatusBadge,
  Textarea
} from '../../components/ui';
import {
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilSquareIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { formatJobType, formatSalary } from '../../utils/helpers';

const FIELD_NAMES = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  phone: 'phone number',
  course: 'course',
  branch: 'branch',
  yearOfStudy: 'year of study',
  graduationYear: 'graduation year',
  cgpa: 'CGPA',
  skills: 'skills',
  bio: 'short bio'
};

const REQUIRED_PROFILE_FIELDS = [
  'course',
  'branch',
  'yearOfStudy',
  'graduationYear',
  'cgpa',
  'skills',
  'bio'
];

// "22 Oct 2026" rather than 22/10/2026: a month name cannot be misread as
// the American order.
const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Has the deadline passed? A deadline is a calendar date in India, so it runs
 * to the end of that day in IST rather than to midnight UTC.
 */
const deadlinePassed = (deadline) => {
  if (!deadline) return false;
  const end = new Date(`${String(deadline).slice(0, 10)}T23:59:59+05:30`);
  return !Number.isNaN(end.getTime()) && end < new Date();
};

// Plain-language names for application stages, for the applicant list.
const STAGE_ORDER = ['applied', 'screening', 'shortlisted', 'interviewed', 'selected', 'rejected', 'withdrawn'];

/** One icon + value pair in the header's metadata strip. */
const Meta = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} />
    {children}
  </span>
);

/** A one-line state banner above the posting. */
const Notice = ({ icon: Icon, title, children }) => (
  <Card className="mb-6 border-saffron-500/40 bg-saffron-50">
    <div className="flex gap-3">
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-saffron-800" />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-saffron-800">{title}</h2>
        <p className="mt-1 text-sm text-ink-700">{children}</p>
      </div>
    </div>
  </Card>
);

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // A failure that is not "no such job" (server restarting, network down):
  // offered as a retry rather than claiming the posting does not exist.
  const [loadError, setLoadError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  // The review dialog: null, 'approve' or 'reject'.
  const [reviewAction, setReviewAction] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);
      // silent: the not-found state below explains it; a toast on top was
      // noise (and appeared twice under StrictMode's double effect).
      const response = await api.get(`/jobs/${id}`, { silent: true });
      // The controller answers `{ message, job }`; older code kept the envelope
      // and every field read came back undefined.
      setJob(response.job || response);
    } catch (error) {
      // The API client has already said why. Stay on the page with a clear
      // not-found state instead of bouncing to /jobs, which read as the link
      // having silently failed.
      setJob(null);
      if (error.status === 404 || error.status === 403 || error.status === 400) setNotFound(true);
      else setLoadError(error.message || 'The server did not respond.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  const handleApply = async () => {
    if (!user) {
      toast.error('Please login to apply');
      navigate('/login');
      return;
    }

    if (user.role !== 'student') {
      toast.error('Only students can apply for jobs');
      return;
    }

    try {
      const resumeResponse = await api.get('/resume/data');
      const { personalInfo, profile } = resumeResponse.data || {};

      const missingUserFields = [];
      if (!personalInfo?.firstName) missingUserFields.push('firstName');
      if (!personalInfo?.lastName) missingUserFields.push('lastName');
      if (!personalInfo?.email) missingUserFields.push('email');
      if (!personalInfo?.phone) missingUserFields.push('phone');

      const missingProfileFields = [];
      if (!profile) {
        missingProfileFields.push(...REQUIRED_PROFILE_FIELDS);
      } else {
        REQUIRED_PROFILE_FIELDS.forEach((field) => {
          const value = profile[field];
          const isCompleted = value && (Array.isArray(value) ? value.length > 0 : true);
          if (!isCompleted) missingProfileFields.push(field);
        });
      }

      if (missingUserFields.length > 0 || missingProfileFields.length > 0) {
        // Name the gaps, so the student knows what to fill in on arrival.
        const missing = [...missingUserFields, ...missingProfileFields].map((f) => FIELD_NAMES[f] || f);
        toast.error(`Before applying, add your ${missing.join(', ')} on your profile.`, { duration: 6000 });
        navigate('/profile');
        return;
      }

      if (!profile?.resumeUrl) {
        toast.error('Please generate your resume from the Resume page before applying.');
        navigate('/resume');
        return;
      }
    } catch (error) {
      // The API client has already shown why the check failed.
      return;
    }

    try {
      setApplying(true);
      const res = await api.post('/applications', { jobId: id, coverLetter: '' });
      toast.success('Application sent. You can follow its progress under Applications.');
      // The server's own record of the application, so the header can link to
      // it; the "already applied" state no longer depends on a paginated list.
      setJob((prev) => ({
        ...prev,
        hasApplied: true,
        userApplication: res.application
          ? { id: res.application.id, status: res.application.status, appliedAt: res.application.appliedAt }
          : { status: 'applied' },
        applicationCount: (prev.applicationCount || 0) + 1
      }));
    } catch (error) {
      // Already toasted with the server's reason (deadline passed, not
      // eligible, already applied). Re-read the job so the page agrees.
      fetchJobDetails();
    } finally {
      setApplying(false);
    }
  };

  /** Open, close, or submit for approval — the posting owner's controls. */
  const changeStatus = async (status) => {
    try {
      setStatusBusy(true);
      const res = await api.patch(`/jobs/${id}/status`, { status });
      toast.success(
        res.job?.status === 'pending_review'
          ? 'Sent to the placement cell for approval'
          : res.job?.status === 'closed'
            ? 'Applications closed. Students can no longer apply.'
            : res.job?.status === 'active'
              ? 'Applications reopened'
              : 'Posting updated'
      );
      await fetchJobDetails();
    } catch (error) {
      // toasted by the API client
    } finally {
      setStatusBusy(false);
    }
  };

  /** The placement cell's decision on a pending posting. */
  const submitReview = async () => {
    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      toast.error('Tell the recruiter what to change, so they can fix it and resubmit.');
      return;
    }
    try {
      setReviewBusy(true);
      await api.patch(`/jobs/${id}/review`, {
        action: reviewAction,
        notes: reviewNotes.trim() || undefined
      });
      toast.success(
        reviewAction === 'approve'
          ? 'Approved. Eligible students are being notified.'
          : 'Sent back to the recruiter with your note.'
      );
      const sentBack = reviewAction === 'reject';
      setReviewAction(null);
      setReviewNotes('');
      // A posting sent back becomes the company's draft, which a TPO from
      // another organisation can no longer open: reloading it here showed
      // "Job not found" straight after a successful action. Return to the
      // queue instead.
      if (sentBack && user?.role !== 'admin' && user?.organizationId !== job?.organizationId) {
        navigate('/approvals');
        return;
      }
      await fetchJobDetails();
    } catch (error) {
      // toasted by the API client
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell width="narrow">
        <SkeletonCard lines={4} className="mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SkeletonCard lines={6} />
            <SkeletonCard lines={4} />
          </div>
          <SkeletonCard lines={5} />
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell width="narrow">
        <ErrorState
          title="Could not load this job"
          description={`${loadError} Check your connection and try again.`}
          onRetry={fetchJobDetails}
        />
      </PageShell>
    );
  }

  if (!job || notFound) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={BriefcaseIcon}
          title="Job not found"
          description="This posting may have been removed, or it is not open to you yet."
          action={
            <Button as={Link} to="/jobs">
              Back to jobs
            </Button>
          }
        />
      </PageShell>
    );
  }

  // `requirements` is stored as a newline-joined string; `skillsRequired` as an
  // array. Both are optional, and an absent one renders no section rather than
  // invented placeholder content.
  const requirements = (typeof job.requirements === 'string' ? job.requirements.split('\n') : [])
    .map((line) => line.trim())
    .filter(Boolean);
  const skills = Array.isArray(job.skillsRequired) ? job.skillsRequired.filter(Boolean) : [];
  const deadline = formatDate(job.applicationDeadline);
  const posted = formatDate(job.createdAt);

  // `GET /api/jobs/:id` returns the student's own verdict against this job's
  // criteria. Without it the page showed an enabled Apply button to everyone
  // and the student found out they were ineligible only from the error toast
  // the rejected request produced.
  const eligibility = job.eligibility;
  const ineligible =
    user?.role === 'student' && eligibility ? eligibility.meetsCriteria === false : false;
  const eligibilityReasons = ineligible ? eligibility.reasons || [] : [];
  const allowedBranches = readAllowedBranches(job.eligibilityCriteria);
  const graduationYears = readGraduationYears(job.eligibilityCriteria);

  const isStudent = user?.role === 'student';
  // Owns the posting: its organisation's recruiters (or a TPO who posted for
  // their own college), and admins. Mirrors `managesPosting` on the server.
  const manages =
    !!user &&
    (user.role === 'admin' ||
      (['recruiter', 'tpo'].includes(user.role) && user.organizationId === job.organizationId));
  // A TPO reviewing another company's posting; the server only returns a
  // pending posting to a TPO entitled to review it.
  const canReview =
    job.status === 'pending_review' && (user?.role === 'admin' || (user?.role === 'tpo' && !manages));
  const isPublished = job.status === 'active' || job.status === 'closed';
  const pastDeadline = deadlinePassed(job.applicationDeadline);
  const applied = Boolean(job.hasApplied);
  const myApplication = job.userApplication;
  // Why a student cannot apply, in the order they would want to know it.
  const applyBlocked =
    job.status !== 'active'
      ? 'Applications are closed'
      : pastDeadline
        ? 'Deadline has passed'
        : ineligible
          ? 'Not eligible'
          : null;

  const applicants = Array.isArray(job.applications) ? job.applications : null;
  const stageCounts = applicants
    ? STAGE_ORDER.map((stage) => ({
        stage,
        count: applicants.filter((a) => a.status === stage).length
      })).filter((s) => s.count > 0)
    : [];

  const studentAction = applied ? (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="success">
        <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
        Applied
      </Badge>
      {myApplication?.id && (
        <Button as={Link} to={`/applications/${myApplication.id}`} size="sm" variant="secondary">
          Track application
        </Button>
      )}
    </div>
  ) : applyBlocked ? (
    <Button variant="secondary" disabled title={applyBlocked}>
      {applyBlocked}
    </Button>
  ) : (
    <Button variant="saffron" loading={applying} onClick={handleApply}>
      Apply now
    </Button>
  );

  const managerActions = manages && (
    <div className="flex flex-wrap items-center gap-2">
      {job.status !== 'cancelled' && (
        <Button as={Link} to={`/jobs/${job.id}/edit`} variant="secondary" icon={PencilSquareIcon}>
          Edit
        </Button>
      )}
      {job.status === 'active' && (
        <Button variant="secondary" loading={statusBusy} onClick={() => changeStatus('closed')}>
          Close applications
        </Button>
      )}
      {job.status === 'closed' && (
        <Button loading={statusBusy} onClick={() => changeStatus('active')}>
          Reopen applications
        </Button>
      )}
      {job.status === 'draft' && (
        <Button loading={statusBusy} onClick={() => changeStatus('active')}>
          {user.role === 'recruiter' ? 'Submit for approval' : 'Publish'}
        </Button>
      )}
    </div>
  );

  const reviewActions = canReview && (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => setReviewAction('reject')}>
        Send back
      </Button>
      <Button onClick={() => setReviewAction('approve')}>Approve and publish</Button>
    </div>
  );

  // What the header's action slot holds for this viewer.
  const headerActions = isStudent ? studentAction : reviewActions || managerActions || null;

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: job.title || 'Job' }]}
        eyebrow={job.organization?.name}
        title={job.title || 'Untitled role'}
        actions={headerActions}
      />

      {/* Where the posting stands, for the people who can act on it. */}
      {manages && job.status === 'pending_review' && (
        <Notice icon={ClockIcon} title="Waiting for the placement cell">
          Students cannot see this posting yet. You will get a notification when it is approved
          or sent back.
        </Notice>
      )}
      {manages && job.status === 'draft' && (
        <Notice
          icon={ExclamationTriangleIcon}
          title={job.reviewNotes ? 'The placement cell sent this back' : 'This is a draft'}
        >
          {job.reviewNotes ? (
            <>
              <span className="block">“{job.reviewNotes}”</span>
              <span className="mt-1 block">Edit the posting, then submit it for approval again.</span>
            </>
          ) : (
            'Only your organisation can see it. Submit it for approval when it is ready.'
          )}
        </Notice>
      )}
      {canReview && (
        <Notice icon={ClockIcon} title="Waiting for your approval">
          Check the role, pay and eligibility rules. Approving publishes it to every eligible
          student and notifies them.
        </Notice>
      )}
      {isStudent && !applied && job.status !== 'active' && (
        <Notice icon={ClockIcon} title="This drive is no longer taking applications">
          The company has closed applications. Keep an eye on Jobs for new drives.
        </Notice>
      )}
      {isStudent && !applied && job.status === 'active' && pastDeadline && (
        <Notice icon={ClockIcon} title="The application deadline has passed">
          Applications closed on {deadline}.
        </Notice>
      )}

      {/* Not shown once applied: a student who is already in the process
          (or holds an offer from it) does not need to be told they cannot
          apply. */}
      {ineligible && !applied && (
        <Card className="mb-6 border-saffron-500/40 bg-saffron-50">
          <div className="flex gap-3">
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-saffron-800"
            />
            <div>
              <h2 className="text-sm font-semibold text-saffron-800">
                You are not eligible for this role
              </h2>
              <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                {eligibilityReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {eligibility?.profileComplete === false && (
                <p className="mt-2 text-sm text-ink-700">
                  Some of this is judged on your profile.{' '}
                  <Link
                    to="/profile"
                    className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-800"
                  >
                    Complete your profile
                  </Link>{' '}
                  so it can be checked properly.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {job.organization?.name && (
            <Meta icon={BuildingOfficeIcon}>{job.organization.name}</Meta>
          )}
          {job.location && <Meta icon={MapPinIcon}>{job.location}</Meta>}
          {job.jobType && <Meta icon={BriefcaseIcon}>{formatJobType(job.jobType)}</Meta>}
          <Meta icon={CurrencyRupeeIcon}>{formatSalary(job.salaryMin, job.salaryMax)}</Meta>
          {deadline && <Meta icon={CalendarIcon}>Apply by {deadline}</Meta>}
          <Meta icon={EyeIcon}>{job.viewCount || 0} view{Number(job.viewCount) === 1 ? '' : 's'}</Meta>
        </div>
        {job.status && (
          <div className="mt-4">
            <StatusBadge status={job.status} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Job description" />
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
              {job.description || 'No description was provided for this role.'}
            </p>
          </Card>

          {requirements.length > 0 && (
            <Card>
              <CardHeader title="Requirements" />
              <ul className="mt-4 space-y-2.5">
                {requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-ink-800">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500"
                    />
                    {req}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {skills.length > 0 && (
            <Card>
              <CardHeader title="Required skills" />
              <div className="mt-4 flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <Badge key={index} tone="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="About the organization" />
            <dl className="mt-3 divide-y divide-ink-950/10">
              <DetailRow label="Name">{job.organization?.name}</DetailRow>
              <DetailRow label="Type">{job.organization?.type}</DetailRow>
              <DetailRow label="Location">
                {job.organization?.city || job.organization?.address}
              </DetailRow>
              <DetailRow label="Website">
                {job.organization?.website ? (
                  <a
                    href={job.organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink-950 underline underline-offset-2 hover:text-saffron-800"
                  >
                    Visit website
                  </a>
                ) : null}
              </DetailRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Job details" />
            <dl className="mt-3 divide-y divide-ink-950/10">
              <DetailRow label="Posted">{posted}</DetailRow>
              <DetailRow label="Experience">
                {job.experienceRequired != null ? `${job.experienceRequired} years` : null}
              </DetailRow>
              <DetailRow label="Openings">{job.totalPositions}</DetailRow>
              {/* A dash read as "unknown"; an absent rule means anyone qualifies. */}
              <DetailRow label="Minimum CGPA">
                {readMinCGPA(job.eligibilityCriteria) ?? 'No minimum'}
              </DetailRow>
              <DetailRow label="Eligible branches">
                {allowedBranches.length > 0 ? allowedBranches.join(', ') : 'All branches'}
              </DetailRow>
              <DetailRow label="Graduating batches">
                {graduationYears.length > 0 ? graduationYears.join(', ') : 'All batches'}
              </DetailRow>
              {ACADEMIC_CRITERIA.map((rule) => {
                const value = readNumeric(job.eligibilityCriteria, rule.camel, rule.snake);
                // DetailRow hides itself when empty, but 0 is a real bar here
                // ("no active backlogs") and must not be treated as absent.
                if (value === undefined) return null;
                return (
                  <DetailRow key={rule.field} label={rule.label}>
                    {rule.field.endsWith('Percentage') ? `${value}%` : String(value)}
                  </DetailRow>
                );
              })}
              <DetailRow label="Applications">{job.applicationCount ?? 0}</DetailRow>
            </dl>
          </Card>
        </div>
      </div>

      {/* Who applied: the full list for the posting's owner, a TPO's own
          students for a placement cell. Previously the job page showed only a
          count, and the people running the drive had to go hunting for the
          applicants in a separate list. */}
      {applicants && !isStudent && (
        <Card padded={false} className="mt-6">
          <div className="px-5 py-4 sm:px-6">
            <CardHeader
              title={manages ? 'Applicants' : 'Your students who applied'}
              description={
                stageCounts.length > 0
                  ? stageCounts.map((s) => `${s.count} ${s.stage}`).join(' · ')
                  : undefined
              }
              actions={
                applicants.length > 0 && (
                  <Button
                    as={Link}
                    to={`/applications?jobId=${job.id}`}
                    size="sm"
                    variant="secondary"
                    iconRight={ArrowRightIcon}
                  >
                    Shortlist and update
                  </Button>
                )
              }
            />
          </div>
          {applicants.length > 0 ? (
            <ul className="divide-y divide-ink-950/10 border-t border-ink-950/10">
              {applicants.map((a) => {
                const name =
                  [a.student?.firstName, a.student?.lastName].filter(Boolean).join(' ') ||
                  'Candidate unavailable';
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-950">{name}</p>
                      <p className="truncate text-xs text-ink-500">{a.student?.email}</p>
                    </div>
                    <StatusBadge status={a.status} />
                    <Button as={Link} to={`/applications/${a.id}`} size="sm" variant="ghost">
                      Open
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-t border-ink-950/10 p-5 sm:p-6">
              <EmptyState
                icon={UserGroupIcon}
                title="No applications yet"
                description={
                  isPublished
                    ? 'Eligible students were notified when this went live. Applications appear here as they come in.'
                    : 'Applications open once the posting is published.'
                }
              />
            </div>
          )}
        </Card>
      )}

      {/* The drive's rounds, for the company that owns it and the placement
          cells running it on campus. Not on an unapproved posting a TPO is
          only reviewing: there is no drive to run yet. */}
      {(manages || (user?.role === 'tpo' && isPublished)) && (
        <div className="mt-6">
          <RoundsManager jobId={job.id} />
        </div>
      )}

      <Modal
        open={Boolean(reviewAction)}
        onClose={() => !reviewBusy && setReviewAction(null)}
        title={reviewAction === 'approve' ? 'Approve this posting?' : 'Send back to the recruiter'}
        description={
          reviewAction === 'approve'
            ? 'It goes live straight away and every eligible student is notified.'
            : 'The posting returns to draft. The recruiter sees your note and can resubmit.'
        }
        footer={
          <>
            <Button variant="secondary" disabled={reviewBusy} onClick={() => setReviewAction(null)}>
              Cancel
            </Button>
            <Button loading={reviewBusy} onClick={submitReview}>
              {reviewAction === 'approve' ? 'Approve and publish' : 'Send back'}
            </Button>
          </>
        }
      >
        <Textarea
          label={reviewAction === 'approve' ? 'Note to the recruiter (optional)' : 'What needs to change'}
          required={reviewAction === 'reject'}
          rows={4}
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder={
            reviewAction === 'approve'
              ? 'e.g. Approved for the 2026 batch.'
              : 'e.g. State the CTC break-up and the bond period, if any.'
          }
        />
      </Modal>
    </PageShell>
  );
};

export default JobDetail;
