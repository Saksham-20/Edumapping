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
  parseBranchList,
  parseYearList,
  readAllowedBranches,
  readGraduationYears,
  readMinCGPA,
  withAllowedBranches,
  withGraduationYears,
  withMinCGPA
} from '../../utils/eligibility';
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
import { LockClosedIcon } from '@heroicons/react/24/outline';

const JOB_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'internship', label: 'Internship' }
];

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
    isActive: true
  });

  const fetchJobDetails = useCallback(async () => {
    try {
      setIsLoadingJob(true);
      const response = await api.get(`/jobs/${id}`);
      const job = response.job || response;

      if (job.organizationId !== user.organizationId) {
        toast.error('You are not authorized to edit this job');
        navigate('/jobs');
        return;
      }

      setEligibilityCriteria(job.eligibilityCriteria || null);

      // Stored as one newline-joined string; the form edits it as rows.
      const requirements = job.requirements
        ? job.requirements.split('\n').filter((req) => req.trim())
        : [''];
      if (requirements.length === 0) requirements.push('');

      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements,
        skillsRequired: job.skillsRequired?.length ? job.skillsRequired : [''],
        jobType: job.jobType || 'full_time',
        location: job.location || '',
        salaryMin: job.salaryMin ? job.salaryMin.toString() : '',
        salaryMax: job.salaryMax ? job.salaryMax.toString() : '',
        experienceRequired: job.experienceRequired || 0,
        totalPositions: job.totalPositions || 1,
        applicationDeadline: job.applicationDeadline ? job.applicationDeadline.split('T')[0] : '',
        minCGPA: readMinCGPA(job.eligibilityCriteria) !== undefined
          ? String(readMinCGPA(job.eligibilityCriteria))
          : '',
        allowedBranches: readAllowedBranches(job.eligibilityCriteria).join(', '),
        graduationYears: readGraduationYears(job.eligibilityCriteria).join(', '),
        isActive: job.status === 'active'
      });
    } catch (error) {
      toast.error('Failed to load job details');
      navigate('/jobs');
    } finally {
      setIsLoadingJob(false);
    }
  }, [id, user.organizationId, navigate]);

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
    if (formData.graduationYears.trim() && parseYearList(formData.graduationYears) === null) {
      newErrors.graduationYears = 'Enter four-digit years separated by commas, e.g. 2025, 2026';
    }

    if (formData.applicationDeadline && new Date(formData.applicationDeadline) <= new Date()) {
      newErrors.applicationDeadline = 'Application deadline must be in the future';
    }

    // The numeric bounds used to be enforced only by the browser's own
    // validation, via min/max on the inputs. Now that the form carries
    // noValidate they have to be checked here, or an out-of-range number would
    // reach the API and come back as a generic toast.
    const negative = (v) => v !== '' && v !== null && v !== undefined && Number(v) < 0;
    if (negative(formData.salaryMin)) newErrors.salaryMin = 'Salary cannot be negative';
    if (negative(formData.salaryMax)) newErrors.salaryMax = 'Salary cannot be negative';
    if (negative(formData.experienceRequired)) {
      newErrors.experienceRequired = 'Experience cannot be negative';
    }
    if (formData.totalPositions !== '' && Number(formData.totalPositions) < 1) {
      newErrors.totalPositions = 'There must be at least one opening';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

      const cleanedData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        jobType: formData.jobType,
        location: formData.location.trim(),
        requirements: formData.requirements.filter((req) => req.trim() !== '').join('\n'),
        skillsRequired: formData.skillsRequired.filter((skill) => skill.trim() !== ''),
        status: formData.isActive ? 'active' : 'draft'
      };

      // Merge rather than replace: the criteria object can carry keys this form
      // does not model, and assigning a fresh object discarded them on save.
      // Every field the form does own is written unconditionally — sending the
      // criteria only when a field was non-empty meant a rule could be cleared
      // in the form and still be enforced on the job.
      let criteria = withMinCGPA(eligibilityCriteria, formData.minCGPA.trim());
      criteria = withAllowedBranches(criteria, parseBranchList(formData.allowedBranches));
      criteria = withGraduationYears(criteria, parseYearList(formData.graduationYears) || []);
      cleanedData.eligibilityCriteria = criteria;

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

      await api.put(`/jobs/${id}`, cleanedData);

      toast.success('Job updated');
      navigate(`/jobs/${id}`);
    } catch (error) {
      if (error.data && error.data.details) {
        toast.error(
          `Validation error: ${error.data.details.map((detail) => detail.message).join(', ')}`
        );
      } else {
        toast.error(error.message || 'Failed to update job');
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
        lead="Update your job posting."
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
              placeholder="e.g. New York, NY"
            />
            <Input
              label="Minimum salary"
              name="salaryMin"
              type="number"
              min="0"
              value={formData.salaryMin}
              onChange={handleInputChange}
              placeholder="50000"
              error={errors.salaryMin}
            />
            <Input
              label="Maximum salary"
              name="salaryMax"
              type="number"
              min="0"
              value={formData.salaryMax}
              onChange={handleInputChange}
              error={errors.salaryMax}
              placeholder="80000"
            />
            <Input
              label="Experience required (years)"
              name="experienceRequired"
              type="number"
              min="0"
              max="20"
              value={formData.experienceRequired}
              onChange={handleInputChange}
              error={errors.experienceRequired}
            />
            <Input
              label="Total positions"
              name="totalPositions"
              type="number"
              min="1"
              max="100"
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
            <Input
              label="Application deadline"
              name="applicationDeadline"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={formData.applicationDeadline}
              onChange={handleInputChange}
              error={errors.applicationDeadline}
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
              placeholder="7.5"
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

          <Checkbox
            label="Keep this job active"
            description="Uncheck to move the posting back to draft."
            name="isActive"
            checked={formData.isActive}
            onChange={handleInputChange}
          />

          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-950/10 pt-6">
            <Button as={Link} to="/jobs" variant="ghost">
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Update job
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
};

export default JobEdit;
