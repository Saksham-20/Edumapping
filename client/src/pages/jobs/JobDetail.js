// client/src/pages/jobs/JobDetail.js
//
// One job posting, plus the student apply flow. Applying is gated client-side
// on a complete profile and a generated resume — the server would accept the
// application either way, but a recruiter reading an empty profile is worse
// than a student being sent back to fill one in.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { readMinCGPA } from '../../utils/eligibility';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  PageHeader,
  PageShell,
  SkeletonCard,
  StatusBadge
} from '../../components/ui';
import {
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const REQUIRED_PROFILE_FIELDS = [
  'course',
  'branch',
  'yearOfStudy',
  'graduationYear',
  'cgpa',
  'skills',
  'bio'
];

const formatSalary = (min, max) => {
  if (!min && !max) return 'Not disclosed';
  if (min && max) return `₹${min.toLocaleString()} – ₹${max.toLocaleString()}`;
  if (min) return `₹${min.toLocaleString()}+`;
  return `Up to ₹${max.toLocaleString()}`;
};

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

/** One icon + value pair in the header's metadata strip. */
const Meta = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} />
    {children}
  </span>
);

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const checkApplicationStatus = useCallback(async (jobId) => {
    if (!jobId) return;
    try {
      const response = await api.get('/applications');
      const applications = response.applications || [];
      setHasApplied(applications.some((app) => app.jobId === parseInt(jobId, 10)));
    } catch (error) {
      // A student who has never applied is the common case here; the list
      // failing is not worth a toast on top of the page they came to read.
    }
  }, []);

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jobs/${id}`);
      // The controller answers `{ message, job }`; older code kept the envelope
      // and every field read came back undefined.
      setJob(response.job || response);

      if (user?.role === 'student') {
        checkApplicationStatus(id);
      }
    } catch (error) {
      toast.error('Failed to load job details');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  }, [id, user?.role, navigate, checkApplicationStatus]);

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
        toast.error('Please complete your profile before applying for jobs.');
        navigate('/profile');
        return;
      }

      if (!profile?.resumeUrl) {
        toast.error('Please generate your resume from the Resume page before applying.');
        navigate('/resume');
        return;
      }
    } catch (error) {
      toast.error('Unable to verify your profile and resume. Please try again.');
      return;
    }

    try {
      setApplying(true);
      await api.post('/applications', { jobId: id, coverLetter: '' });
      toast.success('Application submitted successfully!');
      setHasApplied(true);
    } catch (error) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setApplying(false);
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

  if (!job) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={BriefcaseIcon}
          title="Job not found"
          description="This posting may have been removed or closed."
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

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: job.title || 'Job' }]}
        eyebrow={job.organization?.name}
        title={job.title || 'Untitled role'}
        actions={
          user?.role === 'student' &&
          (hasApplied ? (
            <Badge tone="success">
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
              Applied
            </Badge>
          ) : (
            <Button variant="saffron" loading={applying} onClick={handleApply}>
              Apply now
            </Button>
          ))
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {job.organization?.name && (
            <Meta icon={BuildingOfficeIcon}>{job.organization.name}</Meta>
          )}
          {job.location && <Meta icon={MapPinIcon}>{job.location}</Meta>}
          {job.jobType && <Meta icon={BriefcaseIcon}>{job.jobType.replace('_', ' ')}</Meta>}
          <Meta icon={CurrencyRupeeIcon}>{formatSalary(job.salaryMin, job.salaryMax)}</Meta>
          {deadline && <Meta icon={CalendarIcon}>Apply by {deadline}</Meta>}
          <Meta icon={EyeIcon}>{job.viewCount || 0} views</Meta>
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
              <DetailRow label="Minimum CGPA">{readMinCGPA(job.eligibilityCriteria)}</DetailRow>
              <DetailRow label="Applications">{job.applicationCount ?? 0}</DetailRow>
            </dl>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default JobDetail;
