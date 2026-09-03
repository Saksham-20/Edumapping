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

const JOB_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'internship', label: 'Internship' }
];

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
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Job title is required';
    if (!formData.description.trim()) newErrors.description = 'Job description is required';
    if (!formData.location.trim()) newErrors.location = 'Job location is required';

    if (
      formData.salaryMin &&
      formData.salaryMax &&
      parseInt(formData.salaryMin, 10) > parseInt(formData.salaryMax, 10)
    ) {
      newErrors.salaryMax = 'Maximum salary must be greater than or equal to minimum salary';
    }

    if (formData.minCGPA && (parseFloat(formData.minCGPA) < 0 || parseFloat(formData.minCGPA) > 10)) {
      newErrors.minCGPA = 'CGPA must be between 0 and 10';
    }

    if (formData.applicationDeadline && new Date(formData.applicationDeadline) <= new Date()) {
      newErrors.applicationDeadline = 'Application deadline must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(BLANK_FORM);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || (user.role !== 'recruiter' && user.role !== 'tpo')) {
      toast.error('You are not authorized to post jobs');
      return;
    }

    setErrors({});
    if (!validateForm()) return;

    try {
      setLoading(true);

      const cleanedData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        jobType: formData.jobType,
        location: formData.location.trim(),
        requirements: formData.requirements.filter((req) => req.trim() !== '').join('\n'),
        skillsRequired: formData.skillsRequired.filter((skill) => skill.trim() !== ''),
        status: formData.isActive ? 'active' : 'draft'
      };

      if (formData.minCGPA && formData.minCGPA.trim()) {
        cleanedData.eligibilityCriteria = { minCGPA: parseFloat(formData.minCGPA) };
      }

      // The validators accept these as absent or valid, but not as an empty
      // string — so only send the ones that were filled in.
      if (formData.salaryMin && formData.salaryMin.trim()) {
        cleanedData.salaryMin = parseInt(formData.salaryMin, 10);
      }
      if (formData.salaryMax && formData.salaryMax.trim()) {
        cleanedData.salaryMax = parseInt(formData.salaryMax, 10);
      }
      if (formData.experienceRequired !== undefined && formData.experienceRequired !== '') {
        cleanedData.experienceRequired = parseInt(formData.experienceRequired, 10);
      }
      if (formData.totalPositions && formData.totalPositions > 0) {
        cleanedData.totalPositions = parseInt(formData.totalPositions, 10);
      }
      if (formData.applicationDeadline) {
        cleanedData.applicationDeadline = formData.applicationDeadline;
      }

      const response = await api.post('/jobs', cleanedData);

      toast.success('Job posted');
      resetForm();
      navigate(`/jobs/${response.job.id}`);
    } catch (error) {
      // The API returns validation failures in several shapes depending on
      // which layer rejected the payload; surface the most specific one.
      if (error.data) {
        if (Array.isArray(error.data.details) && error.data.details.length > 0) {
          toast.error(error.data.details.map((detail) => detail.message || detail).join(', '));
        } else if (error.data.message) {
          toast.error(error.data.message);
        } else if (error.data.error) {
          toast.error(error.data.error);
        } else {
          toast.error('Failed to post job. Please check the form and try again.');
        }
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to post job. Please try again.');
      }
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
        lead="Fill in the details to create a new job posting."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
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
            <Input
              label="Minimum salary"
              name="salaryMin"
              type="number"
              min="0"
              value={formData.salaryMin}
              onChange={handleInputChange}
              placeholder="e.g. 500000"
            />
            <Input
              label="Maximum salary"
              name="salaryMax"
              type="number"
              min="0"
              value={formData.salaryMax}
              onChange={handleInputChange}
              error={errors.salaryMax}
              placeholder="e.g. 800000"
            />
            <Input
              label="Experience required (years)"
              name="experienceRequired"
              type="number"
              min="0"
              value={formData.experienceRequired}
              onChange={handleInputChange}
              placeholder="e.g. 2"
            />
            <Input
              label="Number of openings"
              name="totalPositions"
              type="number"
              min="1"
              value={formData.totalPositions}
              onChange={handleInputChange}
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
              label="Application deadline"
              name="applicationDeadline"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={formData.applicationDeadline}
              onChange={handleInputChange}
              error={errors.applicationDeadline}
              help="Select a future date."
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
            label="Publish immediately"
            description="Leave unchecked to save the posting as a draft."
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
              Post job
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
};

export default JobPost;
