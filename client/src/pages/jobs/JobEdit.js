// client/src/pages/jobs/JobEdit.js
//
// Edit an existing posting. Deliberately mirrors JobPost field for field —
// the two share the same payload contract, so a change to one usually belongs
// in the other. The repeatable list control is shared outright.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  ACADEMIC_CRITERIA,
  readNumeric,
  readAllowedBranches,
  readGraduationYears,
  readMinCGPA
} from '../../utils/eligibility';
import {
  JOB_TYPE_OPTIONS,
  PayInputs,
  buildJobPayload,
  deadlineMin,
  jobFieldErrors,
  validateJobForm
} from '../../components/forms/jobForm';
import { rupeesForInput } from '../../components/forms/salary';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  Textarea
} from '../../components/ui';
import { ListField } from './JobPost';
import { BriefcaseIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const JobEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [errors, setErrors] = useState({});
  // The job's original eligibility criteria. Held separately from `formData`
  // because the form only edits the minimum CGPA, and the save has to merge
  // into the rest rather than replace it.
  const [eligibilityCriteria, setEligibilityCriteria] = useState(null);
  // The job's status as loaded. The form used to fold it into one
  // "isActive" checkbox and write back `active ? 'active' : 'draft'`, so
  // saving a posting that was waiting for placement-cell review silently
  // turned it into a draft and dropped it out of the review queue. Status is
  // no longer part of the edit payload at all; only an active/closed posting
  // can be opened or closed here, through the status endpoint.
  const [jobStatus, setJobStatus] = useState(null);
  // The deadline as loaded. Only a changed deadline has to be in the future;
  // a drive whose deadline has passed must still be correctable.
  const [originalDeadline, setOriginalDeadline] = useState('');
  // 'missing' when the job cannot be loaded, 'forbidden' when it belongs to
  // another organisation. Both used to toast and bounce to /jobs, on top of
  // the toast the API client had already shown.
  const [loadProblem, setLoadProblem] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: [''],
    skillsRequired: [''],
    jobType: 'full_time',
    location: '',
    salaryMin: '',
    salaryMax: '',
    experienceRequired: 0,
    totalPositions: 1,
    applicationDeadline: '',
    minCGPA: '',
    allowedBranches: '',
    graduationYears: '',
    maxBacklogs: '',
    minClass10Percentage: '',
    minClass12Percentage: '',
    maxEducationGapYears: '',
    isActive: true
  });

  const fetchJobDetails = useCallback(async () => {
    try {
      setIsLoadingJob(true);
      const response = await api.get(`/jobs/${id}`);
      const job = response.job || response;

      if (job.organizationId !== user.organizationId) {
        setLoadProblem('forbidden');
        return;
      }

      setEligibilityCriteria(job.eligibilityCriteria || null);
      setJobStatus(job.status || null);

      // Stored as one newline-joined string; the form edits it as rows.
      const requirements = job.requirements
        ? job.requirements.split('\n').filter((req) => req.trim())
        : [''];
      if (requirements.length === 0) requirements.push('');

      setOriginalDeadline(job.applicationDeadline ? job.applicationDeadline.split('T')[0] : '');
      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements,
        skillsRequired: job.skillsRequired?.length ? job.skillsRequired : [''],
        jobType: job.jobType || 'full_time',
        location: job.location || '',
        // Shown in Indian grouping ("10,00,000"); the pay inputs accept it back.
        salaryMin: rupeesForInput(job.salaryMin),
        salaryMax: rupeesForInput(job.salaryMax),
        experienceRequired: job.experienceRequired || 0,
        totalPositions: job.totalPositions || 1,
        applicationDeadline: job.applicationDeadline ? job.applicationDeadline.split('T')[0] : '',
        minCGPA: readMinCGPA(job.eligibilityCriteria) !== undefined
          ? String(readMinCGPA(job.eligibilityCriteria))
          : '',
        allowedBranches: readAllowedBranches(job.eligibilityCriteria).join(', '),
        graduationYears: readGraduationYears(job.eligibilityCriteria).join(', '),
        ...Object.fromEntries(
          ACADEMIC_CRITERIA.map((rule) => {
            const value = readNumeric(job.eligibilityCriteria, rule.camel, rule.snake);
            return [rule.field, value === undefined ? '' : String(value)];
          })
        ),
        isActive: job.status === 'active'
      });
    } catch (error) {
      setLoadProblem('missing');
    } finally {
      setIsLoadingJob(false);
    }
  }, [id, user.organizationId]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleArrayInputChange = (index, value, field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item))
    }));
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (index, field) => {
    setFormData((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const validateForm = () => {
    const newErrors = validateJobForm(formData, {
      checkDeadline: formData.applicationDeadline !== originalDeadline
    });
    setErrors(newErrors);
    const first = Object.keys(newErrors)[0];
    if (first) document.getElementsByName(first)[0]?.focus();
    return !first;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || (user.role !== 'recruiter' && user.role !== 'tpo')) {
      toast.error('You are not authorized to edit jobs');
      return;
    }

    setErrors({});
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Merge rather than replace: the criteria object can carry keys this form
      // does not model. Every field the form owns is written, so a rule cleared
      // here is cleared on the job too.
      const response = await api.put(
        `/jobs/${id}`,
        buildJobPayload(formData, { baseCriteria: eligibilityCriteria, editing: true })
      );

      // Opening or closing a live posting is a separate, explicit action.
      const savedStatus = response.job?.status || jobStatus;
      const canToggle = savedStatus === 'active' || savedStatus === 'closed';
      const wantedStatus = formData.isActive ? 'active' : 'closed';
      if (canToggle && wantedStatus !== savedStatus) {
        await api.patch(`/jobs/${id}/status`, { status: wantedStatus });
      }

      toast.success(
        response.sentForReview
          ? 'Saved. The change goes to the placement cell before students see it.'
          : 'Job updated'
      );
      navigate(`/jobs/${id}`);
    } catch (error) {
      // Already toasted by the API client; also mark the fields.
      setErrors(jobFieldErrors(error));
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'recruiter' && user.role !== 'tpo')) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={LockClosedIcon}
          title="Access denied"
          description="Only recruiters and placement officers can edit jobs."
          action={
            <Button as={Link} to="/jobs">
              Back to jobs
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (loadProblem) {
    return (
      <PageShell width="narrow">
        <EmptyState
          icon={loadProblem === 'forbidden' ? LockClosedIcon : BriefcaseIcon}
          title={loadProblem === 'forbidden' ? 'You cannot edit this job' : 'Job not found'}
          description={
            loadProblem === 'forbidden'
              ? 'Only people from the organisation that posted it can edit it.'
              : 'It may have been removed, or the link is wrong.'
          }
          action={
            <Button as={Link} to="/jobs">
              Back to jobs
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (isLoadingJob) {
    return (
      <PageShell width="narrow">
        <SkeletonCard lines={10} />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: 'Jobs', to: '/jobs' },
          { label: formData.title || 'Job', to: `/jobs/${id}` },
          { label: 'Edit' }
        ]}
        eyebrow="Hiring"
        title="Edit job"
        lead="Changes to a live posting reach students straight away, unless they need the placement cell's approval."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Input
            label="Job title"
            name="title"
            required
            value={formData.title}
            onChange={handleInputChange}
            error={errors.title}
            placeholder="e.g. Software Engineer"
          />

          <Textarea
            label="Job description"
            name="description"
            required
            rows={6}
            value={formData.description}
            onChange={handleInputChange}
            error={errors.description}
            placeholder="Describe the role, responsibilities, and what you're looking for…"
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Select
              label="Job type"
              name="jobType"
              value={formData.jobType}
              onChange={handleInputChange}
              options={JOB_TYPE_OPTIONS}
            />
            <Input
              label="Location"
              name="location"
              required
              value={formData.location}
              onChange={handleInputChange}
              error={errors.location}
              placeholder="e.g. Pune, Maharashtra or Remote"
            />
            <PayInputs formData={formData} errors={errors} onChange={handleInputChange} />
            <Input
              label="Experience required (years)"
              name="experienceRequired"
              type="number"
              min="0"
              max="50"
              value={formData.experienceRequired}
              onChange={handleInputChange}
              error={errors.experienceRequired}
            />
            <Input
              label="Number of openings"
              name="totalPositions"
              type="number"
              min="1"
              value={formData.totalPositions}
              onChange={handleInputChange}
              error={errors.totalPositions}
            />
            <Input
              label="Eligible branches"
              name="allowedBranches"
              value={formData.allowedBranches}
              onChange={handleInputChange}
              placeholder="e.g. Computer Science, Information Technology"
              help="Comma separated. Leave blank to accept every branch."
            />
            <Input
              label="Graduating batches"
              name="graduationYears"
              value={formData.graduationYears}
              onChange={handleInputChange}
              error={errors.graduationYears}
              placeholder="e.g. 2026, 2027"
              help="Comma separated years. Leave blank to accept every batch."
            />
            {ACADEMIC_CRITERIA.map((rule) => (
              <Input
                key={rule.field}
                label={rule.label}
                name={rule.field}
                type="number"
                min="0"
                max={rule.max}
                step={rule.integer ? '1' : '0.01'}
                value={formData[rule.field]}
                onChange={handleInputChange}
                error={errors[rule.field]}
                placeholder={rule.placeholder}
                help={rule.help}
              />
            ))}
            <Input
              label="Application deadline"
              name="applicationDeadline"
              type="date"
              min={deadlineMin()}
              value={formData.applicationDeadline}
              onChange={handleInputChange}
              error={errors.applicationDeadline}
              help="The last day students can apply."
            />
            <Input
              label="Minimum CGPA"
              name="minCGPA"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={formData.minCGPA}
              onChange={handleInputChange}
              error={errors.minCGPA}
              placeholder="e.g. 7.0"
              help="Leave blank for no minimum."
            />
          </div>

          <ListField
            legend="Requirements"
            items={formData.requirements}
            placeholder="Enter a requirement…"
            addLabel="Add requirement"
            onChange={(index, value) => handleArrayInputChange(index, value, 'requirements')}
            onAdd={() => addArrayItem('requirements')}
            onRemove={(index) => removeArrayItem(index, 'requirements')}
          />

          <ListField
            legend="Required skills"
            items={formData.skillsRequired}
            placeholder="Enter a skill…"
            addLabel="Add skill"
            onChange={(index, value) => handleArrayInputChange(index, value, 'skillsRequired')}
            onAdd={() => addArrayItem('skillsRequired')}
            onRemove={(index) => removeArrayItem(index, 'skillsRequired')}
          />

          {jobStatus === 'active' || jobStatus === 'closed' ? (
            <Checkbox
              label="Accepting applications"
              description="Uncheck to close the posting to new applications."
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
            />
          ) : (
            <p className="rounded-xl border border-ink-950/10 bg-bone-100 px-4 py-3 text-sm text-ink-700">
              {jobStatus === 'pending_review'
                ? 'This posting is waiting for placement-cell review. Saving your edits keeps it in the review queue.'
                : 'This posting is not published. It goes live once the placement cell approves it.'}
            </p>
          )}
          {jobStatus === 'active' && user.role === 'recruiter' && (
            <p className="text-sm text-ink-600">
              Changing the title, description, requirements, job type, pay or eligibility of a
              live posting sends it back to the placement cell for review before students see the
              change. Openings, location, skills and the deadline save straight away.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-950/10 pt-6">
            <Button as={Link} to={`/jobs/${id}`} variant="ghost">
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
};

export default JobEdit;
