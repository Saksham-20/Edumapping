// client/src/components/forms/jobForm.js
//
// What JobPost and JobEdit share: the pay inputs, client-side validation, the
// payload builder and the mapping of server errors back onto fields. The two
// pages had drifted — the edit form still said "Minimum salary", suggested
// "50000" and "New York, NY", and validated the deadline differently — because
// each kept its own copy.
import React from 'react';
import { Input } from '../ui';
import { fieldErrorsFrom } from '../../services/api';
import {
  ACADEMIC_CRITERIA,
  parseBranchList,
  parseYearList,
  withAllowedBranches,
  withGraduationYears,
  withMinCGPA,
  withNumeric
} from '../../utils/eligibility';
import { describeRupees, parseRupees, tomorrowISO } from './salary';

export const JOB_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'internship', label: 'Internship' }
];

/** Stipends are monthly; every other job type states a yearly CTC. */
const isAnnual = (jobType) => jobType !== 'internship';

/** Minimum and maximum pay, typed the way recruiters write it. */
export const PayInputs = ({ formData, errors, onChange }) => {
  const annual = isAnnual(formData.jobType);
  const field = (name, which) => (
    <Input
      label={annual ? `${which} CTC (₹ a year)` : `${which} stipend (₹ a month)`}
      name={name}
      inputMode="decimal"
      autoComplete="off"
      value={formData[name]}
      onChange={onChange}
      error={errors[name]}
      placeholder={
        annual
          ? which === 'Minimum'
            ? 'e.g. 6 LPA or 6,00,000'
            : 'e.g. 12 LPA or 12,00,000'
          : which === 'Minimum'
            ? 'e.g. 15,000 or 15k'
            : 'e.g. 25,000 or 25k'
      }
      help={describeRupees(formData[name], { annual }) || 'Optional. Leave blank if not disclosed.'}
    />
  );
  return (
    <>
      {field('salaryMin', 'Minimum')}
      {field('salaryMax', 'Maximum')}
    </>
  );
};

/** Today in the browser's calendar, YYYY-MM-DD. */
const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const deadlineMin = tomorrowISO;

/**
 * Field-keyed errors for the job form.
 *
 * @param checkDeadline false on edit when the deadline was not touched: a
 *   posting whose deadline has passed must still be editable.
 */
export const validateJobForm = (formData, { checkDeadline = true } = {}) => {
  const errors = {};
  const annual = isAnnual(formData.jobType);

  if (!formData.title.trim()) errors.title = 'Enter a job title, e.g. Graduate Engineer Trainee';
  else if (formData.title.trim().length < 3) errors.title = 'Job title must be at least 3 characters';
  if (!formData.description.trim()) {
    errors.description = 'Describe the role so students know what they are applying for';
  }
  if (!formData.location.trim()) errors.location = 'Enter where the job is, e.g. Pune or Remote';

  const min = parseRupees(formData.salaryMin, { annual });
  const max = parseRupees(formData.salaryMax, { annual });
  if (min.error) errors.salaryMin = min.error;
  if (max.error) errors.salaryMax = max.error;
  if (!min.error && !max.error && min.value !== null && max.value !== null && min.value > max.value) {
    errors.salaryMax = 'Maximum pay must be greater than or equal to minimum pay';
  }

  if (formData.minCGPA !== '' && formData.minCGPA !== null && formData.minCGPA !== undefined) {
    const cgpa = Number(formData.minCGPA);
    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
      errors.minCGPA = 'CGPA must be between 0 and 10, e.g. 7.5';
    }
  }
  // `parseYearList` returns null when an entry is not a four-digit year, so a
  // typo is reported rather than quietly dropped from the criteria.
  if (formData.graduationYears.trim() && parseYearList(formData.graduationYears) === null) {
    errors.graduationYears = 'Enter four-digit years separated by commas, e.g. 2026, 2027';
  }

  for (const rule of ACADEMIC_CRITERIA) {
    const raw = formData[rule.field];
    if (raw === '' || raw === null || raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > rule.max) {
      errors[rule.field] = `Enter a value between 0 and ${rule.max}`;
    } else if (rule.integer && !Number.isInteger(value)) {
      errors[rule.field] = 'Enter a whole number';
    }
  }

  // Compared as calendar dates. `new Date('2026-10-20')` is midnight UTC, so
  // the old `<= new Date()` check disagreed with the date picker's `min`
  // depending on the hour.
  if (checkDeadline && formData.applicationDeadline && formData.applicationDeadline <= todayISO()) {
    errors.applicationDeadline = 'Pick a date after today, so students have time to apply';
  }

  const exp = formData.experienceRequired;
  if (exp !== '' && exp !== null && exp !== undefined) {
    const n = Number(exp);
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      errors.experienceRequired = 'Enter whole years, 0 for freshers';
    }
  }
  const openings = formData.totalPositions;
  if (openings !== '' && openings !== null && openings !== undefined) {
    const n = Number(openings);
    if (!Number.isInteger(n) || n < 1) errors.totalPositions = 'There must be at least one opening';
  }

  return errors;
};

/**
 * The API payload, minus status.
 *
 * @param baseCriteria the posting's stored criteria on edit, so keys this form
 *   does not model survive the save; null on create.
 * @param editing on edit every owned field is written, so a cleared value
 *   actually clears; on create blanks are simply left out.
 */
export const buildJobPayload = (formData, { baseCriteria = null, editing = false } = {}) => {
  const annual = isAnnual(formData.jobType);
  const payload = {
    title: formData.title.trim(),
    description: formData.description.trim(),
    jobType: formData.jobType,
    location: formData.location.trim(),
    requirements: formData.requirements.filter((r) => r.trim() !== '').join('\n'),
    skillsRequired: formData.skillsRequired.map((s) => s.trim()).filter(Boolean)
  };

  let criteria = withMinCGPA(baseCriteria, String(formData.minCGPA ?? '').trim());
  criteria = withAllowedBranches(criteria, parseBranchList(formData.allowedBranches));
  criteria = withGraduationYears(criteria, parseYearList(formData.graduationYears) || []);
  for (const rule of ACADEMIC_CRITERIA) {
    criteria = withNumeric(criteria, formData[rule.field], rule.camel, rule.snake);
  }
  if (editing || Object.keys(criteria).length > 0) payload.eligibilityCriteria = criteria;

  const min = parseRupees(formData.salaryMin, { annual }).value;
  const max = parseRupees(formData.salaryMax, { annual }).value;
  if (min !== null || editing) payload.salaryMin = min;
  if (max !== null || editing) payload.salaryMax = max;

  if (formData.experienceRequired !== '' && formData.experienceRequired !== null) {
    payload.experienceRequired = parseInt(formData.experienceRequired, 10);
  }
  if (formData.totalPositions !== '' && Number(formData.totalPositions) > 0) {
    payload.totalPositions = parseInt(formData.totalPositions, 10);
  }
  if (formData.applicationDeadline) payload.applicationDeadline = formData.applicationDeadline;
  else if (editing) payload.applicationDeadline = null;

  return payload;
};

// Server field paths that belong to a differently named form input.
const SERVER_FIELD_ALIASES = {
  'eligibilityCriteria.minCGPA': 'minCGPA',
  'eligibilityCriteria.min_cgpa': 'minCGPA',
  'eligibilityCriteria.allowedBranches': 'allowedBranches',
  'eligibilityCriteria.allowed_branches': 'allowedBranches',
  'eligibilityCriteria.graduationYear': 'graduationYears',
  'eligibilityCriteria.graduation_year': 'graduationYears'
};

/** A failed save's per-field messages, keyed by the form's own input names. */
export const jobFieldErrors = (error) => {
  const out = {};
  Object.entries(fieldErrorsFrom(error)).forEach(([field, msg]) => {
    let key = SERVER_FIELD_ALIASES[field];
    if (!key && field.startsWith('eligibilityCriteria.')) {
      const leaf = field.split('.')[1].replace(/\[\d+\]$/, '');
      const rule = ACADEMIC_CRITERIA.find((r) => r.camel === leaf || r.snake === leaf);
      key = rule ? rule.field : SERVER_FIELD_ALIASES[`eligibilityCriteria.${leaf}`];
    }
    out[key || field] = out[key || field] || msg;
  });
  return out;
};
