// client/src/utils/eligibility.js
//
// `jobs.eligibility_criteria` is a free-form JSON column, and it has been
// written in two different shapes: the seeded rows use snake_case
// (`min_cgpa`, `graduation_year`, `allowed_branches`) while the job forms only
// ever wrote `minCGPA`. That mismatch had two consequences — the minimum CGPA
// rendered blank for every seeded job, and saving an edit replaced the whole
// object, silently discarding the graduation years and allowed branches the
// job was created with.
//
// These helpers are the single place that knows about both shapes.

/** Minimum CGPA from either spelling, or undefined when unset. */
export const readMinCGPA = (criteria) => {
  if (!criteria) return undefined;
  const value = criteria.minCGPA ?? criteria.min_cgpa;
  return value === null || value === undefined || value === '' ? undefined : value;
};

/** Graduation years the job accepts, always as an array. */
export const readGraduationYears = (criteria) => {
  const value = criteria?.graduationYear ?? criteria?.graduation_year;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/** Branches the job accepts, always as an array. */
export const readAllowedBranches = (criteria) => {
  const value = criteria?.allowedBranches ?? criteria?.allowed_branches;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Merge a new minimum CGPA into existing criteria, preserving every other key.
 *
 * Assigning `{ minCGPA }` wholesale is what dropped the other constraints on
 * save. Both spellings are written so the value survives a round trip through
 * any reader, old or new.
 */
export const withMinCGPA = (criteria, minCGPA) => {
  const next = { ...(criteria || {}) };
  if (minCGPA === undefined || minCGPA === null || minCGPA === '') {
    delete next.minCGPA;
    delete next.min_cgpa;
    return next;
  }
  const parsed = parseFloat(minCGPA);
  next.minCGPA = parsed;
  next.min_cgpa = parsed;
  return next;
};

/**
 * Merge graduation years into existing criteria, preserving every other key.
 *
 * An empty list means "no restriction", so both spellings are removed rather
 * than written as `[]` — a stored empty array reads the same as no restriction
 * to the server, but leaving it behind makes a cleared field look like a saved
 * one when the form is reopened.
 */
export const withGraduationYears = (criteria, years) => {
  const next = { ...(criteria || {}) };
  if (!years || years.length === 0) {
    delete next.graduationYear;
    delete next.graduation_year;
    return next;
  }
  next.graduationYear = years;
  next.graduation_year = years;
  return next;
};

/** Merge allowed branches into existing criteria, preserving every other key. */
export const withAllowedBranches = (criteria, branches) => {
  const next = { ...(criteria || {}) };
  if (!branches || branches.length === 0) {
    delete next.allowedBranches;
    delete next.allowed_branches;
    return next;
  }
  next.allowedBranches = branches;
  next.allowed_branches = branches;
  return next;
};

/**
 * Turn a comma-separated field into a clean list of branch names.
 *
 * The forms take these as free text because branch naming has no shared
 * vocabulary between institutions; the server matches them tolerantly.
 */
export const parseBranchList = (text) =>
  String(text || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

/**
 * Turn a comma-separated field into a list of graduation years.
 *
 * Returns `null` when any entry is not a plausible year, so the caller can
 * report the field as invalid rather than silently dropping what was typed.
 */
export const parseYearList = (text) => {
  const parts = String(text || '')
    .split(',')
    .map((y) => y.trim())
    .filter(Boolean);
  const years = [];
  for (const part of parts) {
    if (!/^\d{4}$/.test(part)) return null;
    const year = parseInt(part, 10);
    if (year < 1950 || year > 2100) return null;
    years.push(year);
  }
  return years;
};

/**
 * Read a numeric criterion under either spelling.
 *
 * The academic bars — backlogs, Class X and XII percentages, education gap —
 * are stored the same dual-spelling way as the rest of the criteria object.
 */
export const readNumeric = (criteria, ...keys) => {
  for (const key of keys) {
    const value = criteria?.[key];
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

/**
 * Merge one numeric criterion in, under both spellings, preserving everything
 * else. An empty value removes the rule rather than storing a zero — zero is a
 * meaningful bar here ("no active backlogs"), so the two must not be confused.
 */
export const withNumeric = (criteria, value, camelKey, snakeKey) => {
  const next = { ...(criteria || {}) };
  if (value === undefined || value === null || value === '') {
    delete next[camelKey];
    delete next[snakeKey];
    return next;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return next;
  next[camelKey] = parsed;
  next[snakeKey] = parsed;
  return next;
};

/** The academic criteria a job form edits, in one place. */
export const ACADEMIC_CRITERIA = [
  {
    field: 'maxBacklogs',
    camel: 'maxBacklogs',
    snake: 'max_backlogs',
    label: 'Maximum active backlogs',
    placeholder: 'e.g. 0',
    help: 'Enter 0 to require a clear record. Leave blank for no limit.',
    integer: true,
    max: 100
  },
  {
    field: 'minClass10Percentage',
    camel: 'minClass10Percentage',
    snake: 'min_class10_percentage',
    label: 'Minimum Class X %',
    placeholder: 'e.g. 60',
    max: 100
  },
  {
    field: 'minClass12Percentage',
    camel: 'minClass12Percentage',
    snake: 'min_class12_percentage',
    label: 'Minimum Class XII %',
    placeholder: 'e.g. 60',
    help: 'A lateral-entry student clears this on their diploma percentage instead.',
    max: 100
  },
  {
    field: 'maxEducationGapYears',
    camel: 'maxEducationGapYears',
    snake: 'max_education_gap_years',
    label: 'Maximum education gap (years)',
    placeholder: 'e.g. 1',
    integer: true,
    max: 20
  }
];
