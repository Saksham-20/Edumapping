// client/src/pages/applications/ApplicationDetail.js
//
// One application in full: the job, the candidate (reviewers only), a derived
// progress timeline, and the reviewer's status-update control.
//
// The timeline is *inferred* from the current status plus whatever timestamps
// the row carries — there is no event log table, so a status that skipped a
// stage still renders every intermediate stage. See the note on generateTimeline.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import openProtectedFile from '../../utils/openProtectedFile';
import MyRounds from '../../components/rounds/MyRounds';
import RaiseOfferModal from '../../components/forms/RaiseOfferModal';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DetailRow,
  Divider,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  StatusBadge,
  cx
} from '../../components/ui';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  BriefcaseIcon,
  PencilIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { formatJobType } from '../../utils/helpers';

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'selected', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' }
];

const TIMELINE_ICONS = {
  applied: DocumentTextIcon,
  screening: ClockIcon,
  shortlisted: StarIcon,
  interviewed: UserIcon,
  selected: CheckCircleIcon,
  rejected: ExclamationTriangleIcon,
  withdrawn: DocumentTextIcon
};

// The marker ring is the only place a raw colour is warranted: a badge tone
// would not read at 32px, and the ink/saffron/india triad still carries it.
const TIMELINE_TONES = {
  applied: 'bg-ink-950 text-white',
  screening: 'bg-saffron-500 text-ink-950',
  shortlisted: 'bg-saffron-500 text-ink-950',
  interviewed: 'bg-ink-800 text-white',
  selected: 'bg-india-700 text-white',
  rejected: 'bg-red-700 text-white',
  withdrawn: 'bg-bone-300 text-ink-800'
};

const ApplicationDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  // A transient failure (server restarting, offline) is offered as a retry,
  // not reported as "Application not found".
  const [loadError, setLoadError] = useState(null);

  const fetchApplicationDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await api.get(`/applications/${id}`);
      setApplication(response.application || response);
      setNewStatus(response.application?.status || response?.status || '');
    } catch (error) {
      // The API client has already toasted the reason; the page below shows
      // the not-found state. A second, vaguer toast only added noise.
      setApplication(null);
      if (![400, 403, 404].includes(error.status)) setLoadError(error.message || 'The server did not respond.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplicationDetails();
  }, [fetchApplicationDetails]);

  /**
   * Reconstructs the stages an application has passed through.
   *
   * Each stage falls back to `updatedAt` and then `appliedAt` when its own
   * timestamp column is null, so a row that was moved straight to `selected`
   * still renders a dated, ordered history rather than "Invalid Date".
   */
  const generateTimeline = () => {
    if (!application) return [];

    const timeline = [
      {
        status: 'applied',
        label: 'Application submitted',
        date: application.appliedAt,
        description: 'The application was successfully submitted'
      }
    ];

    if (application.status === 'applied') return timeline;

    // A rejection can happen at any stage. Only stages with their own
    // timestamp are shown for one, or a student turned down at screening was
    // told "Interviewed: the interview process is complete".
    const rejected = application.status === 'rejected';

    if (['screening', 'shortlisted', 'interviewed', 'selected'].includes(application.status)) {
      timeline.push({
        status: 'screening',
        label: 'Moved to screening',
        date: application.screeningAt || application.updatedAt || application.appliedAt,
        description: 'The application is under review'
      });
    }

    if (
      ['shortlisted', 'interviewed', 'selected'].includes(application.status) ||
      (rejected && application.shortlistedAt)
    ) {
      timeline.push({
        status: 'shortlisted',
        label: 'Shortlisted',
        date: application.shortlistedAt || application.updatedAt || application.appliedAt,
        description: isStudent ? 'You cleared screening' : 'The candidate cleared screening'
      });
    }

    if (['interviewed', 'selected'].includes(application.status) || (rejected && application.interviewedAt)) {
      timeline.push({
        status: 'interviewed',
        label: 'Interviewed',
        date: application.interviewedAt || application.updatedAt || application.appliedAt,
        description: 'The interview process is complete'
      });
    }

    if (['selected', 'rejected'].includes(application.status)) {
      timeline.push({
        status: application.status,
        label: application.status === 'selected' ? 'Selected' : 'Not selected',
        date: application.resultAt || application.updatedAt || application.appliedAt,
        description:
          application.status === 'selected'
            ? 'Selected for the position'
            : 'The application was not taken forward'
      });
    }

    if (application.status === 'withdrawn') {
      timeline.push({
        status: 'withdrawn',
        label: 'Application withdrawn',
        date: application.updatedAt || application.appliedAt,
        description: isStudent ? 'You withdrew this application' : 'The candidate withdrew this application'
      });
    }

    return timeline;
  };

  // The student whose application this is. They see "you" rather than "the
  // candidate", and can withdraw from here as well as from the list.
  const isStudent = user?.role === 'student';
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  // The offer dialog, opened from right where the recruiter marks someone
  // selected rather than only from the applications list.
  const [offerOpen, setOfferOpen] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const canWithdraw =
    isStudent && application && ['applied', 'screening', 'shortlisted', 'interviewed'].includes(application.status);

  const handleWithdraw = async () => {
    try {
      setWithdrawBusy(true);
      await api.patch(`/applications/${id}/withdraw`);
      toast.success('Application withdrawn. You can apply again while the drive is open.');
      setConfirmWithdraw(false);
      await fetchApplicationDetails();
    } catch (error) {
      // The API layer has shown the server's reason.
    } finally {
      setWithdrawBusy(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === application.status) {
      toast.error('Please select a different status');
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await api.patch(`/applications/${id}/status`, {
        status: newStatus,
        feedback: feedback.trim() || undefined
      });

      toast.success('Status updated. The student has been notified.');
      setShowStatusUpdate(false);
      setFeedback('');
      await fetchApplicationDetails();
    } catch (error) {
      // Already toasted with the server's reason (e.g. a withdrawn application).
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const canUpdateStatus = () => {
    if (!user || !application) return false;
    // A withdrawal is final on the server; offering the control only led to
    // an error.
    if (application.status === 'withdrawn') return false;
    if (user.role === 'admin') return true;
    if (user.role === 'recruiter') return application?.job?.organizationId === user.organizationId;
    // A TPO owns the student, not the posting, so their check runs the other way.
    if (user.role === 'tpo') return application?.student?.organizationId === user.organizationId;
    return false;
  };

  // Offers are raised by the people who can move the application: the
  // company, its institution's TPO, an admin. Once there is one, the button
  // becomes a link to it.
  const canRaiseOffer =
    !isStudent &&
    canUpdateStatus() &&
    !application?.offer &&
    ['shortlisted', 'interviewed', 'selected'].includes(application?.status);

  if (isLoading) {
    return (
      <PageShell width="narrow">
        <SkeletonCard lines={3} className="mb-6" />
        <SkeletonCard lines={6} />
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell width="narrow">
        <ErrorState
          title="Could not load this application"
          description={`${loadError} Check your connection and try again.`}
          onRetry={fetchApplicationDetails}
        />
      </PageShell>
    );
  }

  if (!application) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={DocumentTextIcon}
          title="Application not found"
          description="It may have been removed, or you may not have permission to view it."
          action={
            <Button as={Link} to="/applications">
              Back to applications
            </Button>
          }
        />
      </PageShell>
    );
  }

  const timeline = generateTimeline();
  const student = application.student;
  const studentProfile = student?.studentProfile;
  const showStudent = user && ['recruiter', 'admin', 'tpo'].includes(user.role) && student;

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: 'Applications', to: '/applications' },
          { label: application.job?.title || 'Application' }
        ]}
        eyebrow="Application"
        title={application.job?.title || 'Application details'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={application.status} />
            {isStudent && application.status === 'selected' && (
              <Button as={Link} to="/offers" size="sm" variant="saffron">
                See your offer
              </Button>
            )}
            {canWithdraw && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmWithdraw(true)}>
                Withdraw
              </Button>
            )}
            {!isStudent && application.offer && (
              <Button as={Link} to="/offers" size="sm" variant="secondary" icon={BanknotesIcon}>
                {application.offer.status === 'offered' ? 'Offer sent' : `Offer ${application.offer.status}`}
              </Button>
            )}
            {canRaiseOffer && (
              <Button size="sm" variant="saffron" icon={BanknotesIcon} onClick={() => setOfferOpen(true)}>
                Raise offer
              </Button>
            )}
          </div>
        }
      />

      <RaiseOfferModal
        application={offerOpen ? application : null}
        onClose={() => setOfferOpen(false)}
        onRaised={() => fetchApplicationDetails()}
      />

      <Card className="mb-6">
        <CardHeader
          title="Job information"
          actions={
            <Button
              as={Link}
              to={`/jobs/${application.job?.id}`}
              size="sm"
              variant="secondary"
              icon={BriefcaseIcon}
            >
              View job
            </Button>
          }
        />
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-ink-600">
          <span className="inline-flex items-center gap-1.5">
            <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            {application.job?.organization?.name || 'Unknown organization'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            {application.job?.location || 'Not specified'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DocumentTextIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            {formatJobType(application.job?.jobType) || 'Not specified'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            Applied {new Date(application.appliedAt).toLocaleDateString()}
          </span>
        </div>
      </Card>

      {user?.role === 'student' && <MyRounds applicationId={application.id} title="Selection rounds" />}

      {showStudent && (
        <Card className="mb-6">
          <CardHeader
            title="Candidate"
            actions={
              studentProfile?.verificationStatus === 'verified' ? (
                <Badge tone="success" dot>
                  Verified by placement cell
                </Badge>
              ) : null
            }
          />
          <div className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <dl className="divide-y divide-ink-950/10">
              <DetailRow label="Name">
                {`${student.firstName || ''} ${student.lastName || ''}`.trim()}
              </DetailRow>
              {/* break-all: a long college address has no spaces to wrap at
                  and ran into the next column. */}
              <DetailRow label="Email">
                <span className="break-all">{student.email}</span>
              </DetailRow>
              <DetailRow label="Phone">{student.phone}</DetailRow>
              {/* The roll number is how placement cells and companies
                  exchange shortlists. */}
              {studentProfile?.studentId && (
                <DetailRow label="Roll number">{studentProfile.studentId}</DetailRow>
              )}
            </dl>
            {studentProfile && (
              <dl className="divide-y divide-ink-950/10">
                <DetailRow label="Course">
                  {[studentProfile.course, studentProfile.branch].filter(Boolean).join(' · ')}
                </DetailRow>
                <DetailRow label="CGPA">{studentProfile.cgpa}</DetailRow>
                <DetailRow label="Year">
                  {[
                    studentProfile.yearOfStudy,
                    studentProfile.graduationYear && `graduating ${studentProfile.graduationYear}`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </DetailRow>
                {studentProfile.percentage && (
                  <DetailRow label="Percentage">{`${studentProfile.percentage}%`}</DetailRow>
                )}
                {(studentProfile.class10Percentage != null || studentProfile.class12Percentage != null) && (
                  <DetailRow label="Class X / XII">
                    {[studentProfile.class10Percentage, studentProfile.class12Percentage ?? studentProfile.diplomaPercentage]
                      .map((v) => (v == null ? '—' : `${v}%`))
                      .join(' / ')}
                  </DetailRow>
                )}
                {studentProfile.activeBacklogs != null && (
                  <DetailRow label="Active backlogs">{String(studentProfile.activeBacklogs)}</DetailRow>
                )}
              </dl>
            )}
          </div>

          {studentProfile?.skills?.length > 0 && (
            <>
              <Divider className="my-5" />
              <h3 className="text-[11px] font-medium uppercase tracking-[0.07em] text-ink-500">
                Skills
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {studentProfile.skills.map((skill, index) => (
                  <Badge key={index} tone="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {/* The resume submitted with this application first: the profile's
              current one may have changed since they applied. */}
          {(application.resumeUrl || studentProfile?.resumeUrl) && (
            <div className="mt-5">
              <Button
                // Resumes are private: fetched with the Bearer token, not a public link.
                onClick={() => openProtectedFile(application.resumeUrl || studentProfile.resumeUrl)}
                size="sm"
                variant="secondary"
                icon={DocumentArrowDownIcon}
              >
                View resume
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader
          title="Timeline"
          actions={
            canUpdateStatus() && (
              <Button
                size="sm"
                variant="secondary"
                icon={PencilIcon}
                aria-expanded={showStatusUpdate}
                onClick={() => setShowStatusUpdate(!showStatusUpdate)}
              >
                Update status
              </Button>
            )
          }
        />

        {showStatusUpdate && canUpdateStatus() && (
          <div className="mt-5 rounded-2xl border border-ink-950/15 bg-bone-50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="New status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
              <Input
                label="Note to the student"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Cleared the technical round"
                help="Optional. The student sees this with the new status."
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" loading={isUpdatingStatus} onClick={handleStatusUpdate}>
                Save status
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowStatusUpdate(false);
                  setNewStatus(application.status);
                  setFeedback('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <ol className="mt-6 space-y-0">
          {timeline.map((item, index) => {
            const Icon = TIMELINE_ICONS[item.status] || DocumentTextIcon;
            const last = index === timeline.length - 1;
            return (
              <li key={index} className="relative flex gap-4 pb-6 last:pb-0">
                {!last && (
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-ink-950/15"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cx(
                    'relative z-[1] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-950/15',
                    TIMELINE_TONES[item.status] || 'bg-bone-300 text-ink-800'
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 pt-1">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950">{item.label}</p>
                    <p className="text-sm text-ink-600">{item.description}</p>
                  </div>
                  {item.date && (
                    <time dateTime={item.date} className="shrink-0 text-xs text-ink-500">
                      {new Date(item.date).toLocaleDateString()}
                    </time>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {application.feedback && (
        <Card className="mb-6">
          <CardHeader title={user?.role === 'student' ? 'Note from the recruiter' : 'Latest note to the student'} />
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
            {application.feedback}
          </p>
        </Card>
      )}

      {application.coverLetter && (
        <Card className="mb-6">
          <CardHeader title="Cover letter" />
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
            {application.coverLetter}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button as={Link} to="/applications" variant="secondary" icon={ArrowLeftIcon}>
          Back to applications
        </Button>
        <Button as={Link} to={`/jobs/${application.job?.id}`}>
          View job details
        </Button>
      </div>
      <Modal
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title="Withdraw this application?"
        description="The company will no longer consider you for this drive. While it is still open you can apply again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={withdrawBusy} onClick={handleWithdraw}>
              Withdraw
            </Button>
          </>
        }
      />
    </PageShell>
  );
};

export default ApplicationDetail;
