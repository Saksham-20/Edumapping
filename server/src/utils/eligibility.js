// server/src/utils/eligibility.js
//
// `jobs.eligibility_criteria` is a free-form JSON column and has been written
// in two shapes: seeded and imported rows use snake_case (`min_cgpa`,
// `graduation_year`, `allowed_branches`) while the job forms write camelCase
// (`minCGPA`). The application check only ever looked at the camelCase keys, so
// for every job created outside the form the eligibility rules were stored,
// displayed, and never enforced.
//
// This module is the single place that understands both shapes, and the only
// place that decides whether a student meets a job's criteria.

/**
 * A numeric criterion under either spelling, or null when the job sets none.
 *
 * Every rule below is optional. An unset rule is not a bar, and — importantly —
 * neither is a value the student has not filled in: blocking on absent data is
 * indistinguishable to the student from blocking on a bad score, and produces a
 * rejection they cannot act on. The profile screen is where incomplete data is
 * chased, not the apply button.
 */
const readNumber = (criteria, ...keys) => {
  for (const key of keys) {
    const value = criteria?.[key];
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

/** Minimum CGPA, from either spelling. `null` when the job sets none. */
const readMinCgpa = (criteria) => {
  const value = criteria?.minCGPA ?? criteria?.min_cgpa;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Accepted graduation years, always an array. Empty means "no restriction". */
const readGraduationYears = (criteria) => {
  const value = criteria?.graduationYear ?? criteria?.graduation_year;
  if (value === null || value === undefined || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(Number).filter(Number.isFinite);
};

/** Accepted branches, always an array. Empty means "no restriction". */
const readAllowedBranches = (criteria) => {
  const value = criteria?.allowedBranches ?? criteria?.allowed_branches;
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((b) => String(b).trim()).filter(Boolean);
};

/**
 * Do two branch names refer to the same discipline?
 *
 * Deliberately tolerant. Jobs are posted against short labels ("Computer
 * Science") while student profiles carry the full programme name ("Computer
 * Science Engineering"), and the two are typed by different people with no
 * shared vocabulary. An exact match would reject every genuinely eligible
 * student, which is a far worse failure than letting a near-match through —
 * so one name containing the other counts as a match.
 */
const branchesMatch = (a, b) => {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

/**
 * Check a student profile against a job's criteria.
 *
 * Returns `{ eligible, reasons }` rather than throwing, so a caller can either
 * block an application or simply show the student why they do not qualify.
 * A missing profile or missing criteria is treated as "no restriction to
 * apply" — the caller decides whether an incomplete profile is itself a bar.
 */
const checkEligibility = (criteria, studentProfile) => {
  const reasons = [];
  if (!criteria || !studentProfile) return { eligible: true, reasons };

  const minCgpa = readMinCgpa(criteria);
  if (minCgpa !== null) {
    const cgpa = Number(studentProfile.cgpa);
    // An unset CGPA is not a failure: the student has not filled it in, and
    // blocking on absent data would be indistinguishable from blocking on a
    // low score.
    if (Number.isFinite(cgpa) && cgpa < minCgpa) {
      reasons.push(`This role requires a minimum CGPA of ${minCgpa}; your profile shows ${cgpa}.`);
    }
  }

  const years = readGraduationYears(criteria);
  if (years.length > 0) {
    const year = Number(studentProfile.graduationYear);
    if (Number.isFinite(year) && !years.includes(year)) {
      reasons.push(`This role is open to the ${years.join(', ')} graduating batch${years.length > 1 ? 'es' : ''}.`);
    }
  }

  const branches = readAllowedBranches(criteria);
  if (branches.length > 0 && studentProfile.branch) {
    if (!branches.some((b) => branchesMatch(b, studentProfile.branch))) {
      reasons.push(`This role is open to ${branches.join(', ')}.`);
    }
  }

  // Active backlogs. "No active backlogs" is the single most common bar on an
  // Indian job description, and it is expressed as a maximum of zero.
  const maxBacklogs = readNumber(criteria, 'maxBacklogs', 'max_backlogs');
  if (maxBacklogs !== null) {
    const backlogs = Number(studentProfile.activeBacklogs);
    if (Number.isFinite(backlogs) && backlogs > maxBacklogs) {
      reasons.push(
        maxBacklogs === 0
          ? `This role requires no active backlogs; your profile shows ${backlogs}.`
          : `This role allows at most ${maxBacklogs} active backlog${maxBacklogs === 1 ? '' : 's'}; your profile shows ${backlogs}.`
      );
    }
  }

  // Class X and Class XII, canonically "60% in 10th and 12th".
  const minClass10 = readNumber(criteria, 'minClass10Percentage', 'min_class10_percentage');
  if (minClass10 !== null) {
    const pct = Number(studentProfile.class10Percentage);
    if (Number.isFinite(pct) && pct < minClass10) {
      reasons.push(`This role requires ${minClass10}% in Class X; your profile shows ${pct}%.`);
    }
  }

  // A lateral-entry student has a diploma instead of Class XII, so either one
  // clearing the bar is enough. Failing both is what disqualifies.
  const minClass12 = readNumber(criteria, 'minClass12Percentage', 'min_class12_percentage');
  if (minClass12 !== null) {
    const twelfth = Number(studentProfile.class12Percentage);
    const diploma = Number(studentProfile.diplomaPercentage);
    const haveTwelfth = Number.isFinite(twelfth);
    const haveDiploma = Number.isFinite(diploma);
    if (haveTwelfth || haveDiploma) {
      const best = Math.max(haveTwelfth ? twelfth : -Infinity, haveDiploma ? diploma : -Infinity);
      if (best < minClass12) {
        reasons.push(
          `This role requires ${minClass12}% in Class XII or an equivalent diploma; your profile shows ${best}%.`
        );
      }
    }
  }

  const maxGap = readNumber(criteria, 'maxEducationGapYears', 'max_education_gap_years');
  if (maxGap !== null) {
    const gap = Number(studentProfile.educationGapYears);
    if (Number.isFinite(gap) && gap > maxGap) {
      reasons.push(
        maxGap === 0
          ? `This role does not accept any gap in education; your profile shows ${gap} year${gap === 1 ? '' : 's'}.`
          : `This role allows a gap of at most ${maxGap} year${maxGap === 1 ? '' : 's'}; your profile shows ${gap}.`
      );
    }
  }

  return { eligible: reasons.length === 0, reasons };
};

/** Criteria in one normalised shape, for display. */
const describeEligibility = (criteria) => ({
  minCGPA: readMinCgpa(criteria),
  graduationYears: readGraduationYears(criteria),
  allowedBranches: readAllowedBranches(criteria),
  maxBacklogs: readNumber(criteria, 'maxBacklogs', 'max_backlogs'),
  minClass10Percentage: readNumber(criteria, 'minClass10Percentage', 'min_class10_percentage'),
  minClass12Percentage: readNumber(criteria, 'minClass12Percentage', 'min_class12_percentage'),
  maxEducationGapYears: readNumber(criteria, 'maxEducationGapYears', 'max_education_gap_years')
});

module.exports = {
  readNumber,
  readMinCgpa,
  readGraduationYears,
  readAllowedBranches,
  branchesMatch,
  checkEligibility,
  describeEligibility
};
