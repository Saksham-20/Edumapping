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
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DetailRow,
  Divider,
  EmptyState,
  Input,
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
  PencilIcon
} from '@heroicons/react/24/outline';

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

  const fetchApplicationDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/applications/${id}`);
      setApplication(response.application || response);
      setNewStatus(response.application?.status || response?.status || '');
    } catch (error) {
      if (error.status === 403) {
        toast.error('Access denied. You do not have permission to view this application.');
      } else {
        toast.error('Failed to load application details');
      }
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

    if (['screening', 'shortlisted', 'interviewed', 'selected', 'rejected'].includes(application.status)) {
      timeline.push({
        status: 'screening',
        label: 'Moved to screening',
        date: application.screeningAt || application.updatedAt || application.appliedAt,
        description: 'The application is under review'
      });
    }

    if (['shortlisted', 'interviewed', 'selected', 'rejected'].includes(application.status)) {
      timeline.push({
        status: 'shortlisted',
        label: 'Shortlisted',
        date: application.shortlistedAt || application.updatedAt || application.appliedAt,
        description: 'The candidate cleared screening'
      });
    }

    if (['interviewed', 'selected', 'rejected'].includes(application.status)) {
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
        description: 'The candidate withdrew this application'
      });
    }

    return timeline;
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

      toast.success('Application status updated successfully');
      setShowStatusUpdate(false);
      setFeedback('');
      await fetchApplicationDetails();
    } catch (error) {
      toast.error('Failed to update application status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const canUpdateStatus = () => {
    if (!user || !application) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'recruiter') return application?.job?.organizationId === user.organizationId;
    // A TPO owns the student, not the posting, so their check runs the other way.
    if (user.role === 'tpo') return application?.student?.organizationId === user.organizationId;
    return false;
  };

  if (isLoading) {
    return (
      <PageShell width="narrow">
        <SkeletonCard lines={3} className="mb-6" />
        <SkeletonCard lines={6} />
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
        actions={<StatusBadge status={application.status} />}
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
            {application.job?.jobType?.replace('_', ' ') || 'Not specified'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            Applied {new Date(application.appliedAt).toLocaleDateString()}
          </span>
        </div>
      </Card>

      {showStudent && (
        <Card className="mb-6">
          <CardHeader title="Candidate" />
          <div className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <dl className="divide-y divide-ink-950/10">
              <DetailRow label="Name">
                {`${student.firstName || ''} ${student.lastName || ''}`.trim()}
              </DetailRow>
              <DetailRow label="Email">{student.email}</DetailRow>
              <DetailRow label="Phone">{student.phone}</DetailRow>
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
              </dl>
            )}
          </div>

          {studentProfile?.skills?.length > 0 && (
            <>
              <Divider className="my-5" />
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
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

          {studentProfile?.resumeUrl && (
            <div className="mt-5">
              <Button
                as="a"
                href={studentProfile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
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
                label="Feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Add feedback or notes…"
                help="Optional. Shared with the candidate."
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
    </PageShell>
  );
};

export default ApplicationDetail;
