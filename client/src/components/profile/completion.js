// client/src/components/profile/completion.js
//
// How complete a profile is, in one place for the profile page, the student
// dashboard and the resume page. They used to share a helper but fed it
// different shapes, and the helper only counted a section when it was present:
// a student with no academic record yet was scored on name and email alone
// (an empty sign-up showed 67% while an imported student with real data showed
// 60%), and right after saving the profile, the save response carried no
// achievements, so that section dropped out of the sum and the page said
// "Profile complete" while the dashboard said 80%.
//
// Here every section always counts for a student, whatever is missing.

const BASIC_FIELDS = ['firstName', 'lastName', 'email', 'phone'];
const STUDENT_FIELDS = ['course', 'branch', 'yearOfStudy', 'graduationYear', 'cgpa', 'skills', 'bio', 'linkedinUrl'];
// School students have no branch, CGPA or graduating batch to fill in.
const SCHOOL_STUDENT_FIELDS = ['course', 'yearOfStudy', 'skills', 'bio'];

const filled = (value) =>
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== '';

/**
 * @param person  { firstName, lastName, email, phone, role, organization?, studentProfile?, achievements? }
 * @param role    the profile owner's role; defaults to person.role
 * @returns integer percentage, 0-100
 */
export const profileCompletion = (person, role = person?.role) => {
  if (!person) return 0;
  let score = 0;
  let total = 0;

  BASIC_FIELDS.forEach((field) => {
    total += 10;
    if (filled(person[field])) score += 10;
  });

  if (role === 'student') {
    const fields = person.organization?.type === 'school' ? SCHOOL_STUDENT_FIELDS : STUDENT_FIELDS;
    const weight = 40 / fields.length;
    const sp = person.studentProfile || {};
    fields.forEach((field) => {
      total += weight;
      if (filled(sp[field])) score += weight;
    });
    // Achievements: 5 points each, up to four.
    total += 20;
    const count = Array.isArray(person.achievements) ? person.achievements.length : 0;
    score += Math.min(20, count * 5);
  }

  return total > 0 ? Math.round((score / total) * 100) : 0;
};

export default profileCompletion;
