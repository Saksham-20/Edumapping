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
