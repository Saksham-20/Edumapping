// client/src/pages/jobs/JobPost.js
//
// Create a job posting. The form models requirements and skills as editable
// lists, but the API takes requirements as one newline-joined string and skills
// as an array — the join/split happens at the submit boundary, here and in the
// mirrored JobEdit.
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { ACADEMIC_CRITERIA } from '../../utils/eligibility';
import {
  JOB_TYPE_OPTIONS,
  PayInputs,
  buildJobPayload,
  deadlineMin,
  jobFieldErrors,
  validateJobForm
} from '../../components/forms/jobForm';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  PageShell,
  Select,
  Textarea
} from '../../components/ui';
import { PlusIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const BLANK_FORM = {
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
};

/**
 * A repeatable single-line list field (requirements, skills).
 *
 * Each row gets its own visible label, hidden from sight but not from a screen
 * reader — without it every row announces as an unlabelled text box.
 */
export const ListField = ({ legend, items, placeholder, onChange, onAdd, onRemove, addLabel }) => (
  <fieldset>
    <legend className="mb-1.5 block text-sm font-medium text-ink-800">{legend}</legend>
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            aria-label={`${legend} ${index + 1}`}
            onChange={(e) => onChange(index, e.target.value)}
            placeholder={placeholder}
            className="block w-full rounded-xl border border-ink-950/20 bg-white px-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-500 transition-colors duration-150 hover:border-ink-950/40 focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/15"
          />
          {items.length > 1 && (
            <IconButton
              icon={XMarkIcon}
              variant="danger"
              size="sm"
              label={`Remove ${legend} ${index + 1}`}
              onClick={() => onRemove(index)}
            />
          )}
        </div>
      ))}
    </div>
    <Button size="sm" variant="secondary" icon={PlusIcon} className="mt-3" onClick={onAdd}>
      {addLabel}
    </Button>
  </fieldset>
);

const JobPost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(BLANK_FORM);

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
    const newErrors = validateJobForm(formData);
    setErrors(newErrors);
    // Point at the first problem: on a phone the error is usually off-screen.
    const first = Object.keys(newErrors)[0];
    if (first) document.getElementsByName(first)[0]?.focus();
    return !first;
  };

  const resetForm = () => {
    setFormData(BLANK_FORM);
    setErrors({});
  };

  // A recruiter's posting goes to the placement cell first (the server turns
  // "active" into pending_review); a TPO's publishes directly. The checkbox and
  // the confirmation say which, instead of promising a recruiter "Publish
  // immediately" and then quietly queueing it.
  const isRecruiter = user?.role === 'recruiter';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!user || (user.role !== 'recruiter' && user.role !== 'tpo')) {
      toast.error('Only recruiters and placement officers can post jobs');
      return;
    }

    setErrors({});
    if (!validateForm()) return;

    try {
      setLoading(true);
      const payload = {
        ...buildJobPayload(formData),
        status: formData.isActive ? 'active' : 'draft'
      };
      const response = await api.post('/jobs', payload);
      const status = response.job?.status;

      toast.success(
        status === 'pending_review'
          ? 'Sent to the placement cell. Students will see it once it is approved.'
          : status === 'draft'
            ? 'Saved as a draft. Only your organisation can see it.'
            : 'Job published'
      );
      resetForm();
      navigate(`/jobs/${response.job.id}`);
    } catch (error) {
      // The shared client has already toasted the reason; put each message
      // under its own field too, so the recruiter can see what to fix.
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
          description="Only recruiters and placement officers can post jobs."
          action={
            <Button as={Link} to="/jobs">
              Back to jobs
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: 'New posting' }]}
        eyebrow="Hiring"
        title="Post a new job"
        lead={
          isRecruiter
            ? 'Students see the posting once the placement cell approves it. Fields marked * are required.'
            : 'Fields marked * are required.'
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input
              label="Job title"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              error={errors.title}
              placeholder="e.g. Software Engineer"
            />
            <Select
              label="Job type"
              name="jobType"
              required
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
              placeholder="e.g. Mumbai, India / Remote"
            />
            <PayInputs formData={formData} errors={errors} onChange={handleInputChange} />
            <Input
              label="Experience required (years)"
              name="experienceRequired"
              type="number"
              min="0"
              value={formData.experienceRequired}
              onChange={handleInputChange}
              placeholder="0 for freshers"
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
              label="Minimum CGPA"
              name="minCGPA"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={formData.minCGPA}
              onChange={handleInputChange}
              error={errors.minCGPA}
              placeholder="e.g. 7.0"
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
              help="The last day students can apply. Must be after today."
            />
          </div>

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

          <ListField
            legend="Requirements"
            items={formData.requirements}
            placeholder="Enter a requirement"
            addLabel="Add requirement"
            onChange={(index, value) => handleArrayInputChange(index, value, 'requirements')}
            onAdd={() => addArrayItem('requirements')}
            onRemove={(index) => removeArrayItem(index, 'requirements')}
          />

          <ListField
            legend="Required skills"
            items={formData.skillsRequired}
            placeholder="Enter a skill"
            addLabel="Add skill"
            onChange={(index, value) => handleArrayInputChange(index, value, 'skillsRequired')}
            onAdd={() => addArrayItem('skillsRequired')}
            onRemove={(index) => removeArrayItem(index, 'skillsRequired')}
          />

          <Checkbox
            label={isRecruiter ? 'Submit to the placement cell for approval' : 'Publish immediately'}
            description={
              isRecruiter
                ? 'Leave unchecked to save a draft that only your organisation can see.'
                : 'Leave unchecked to save the posting as a draft.'
            }
            name="isActive"
            checked={formData.isActive}
            onChange={handleInputChange}
          />

          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-950/10 pt-6">
            <Button as={Link} to="/jobs" variant="ghost">
              Cancel
            </Button>
            <Button variant="secondary" disabled={loading} onClick={resetForm}>
              Reset
            </Button>
            <Button type="submit" loading={loading}>
              {!formData.isActive ? 'Save draft' : isRecruiter ? 'Submit for approval' : 'Post job'}
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
};

export default JobPost;
