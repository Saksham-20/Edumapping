// server/src/services/accessService.js
/**
 * Who may look at another person's record.
 *
 * Several endpoints hand out one user's data by id — the profile, the
 * achievements list, the resume and marksheet files. Each of them used to check
 * nothing beyond "is somebody signed in", so any student could read any other
 * student's phone number, marks and resume by counting upwards from 1, and the
 * people involved include school students who are minors. This is the single
 * rule all of them now apply, so they cannot drift apart:
 *
 *   * yourself;
 *   * a platform admin;
 *   * staff of the same institution (TPO, principal, teacher, school admin,
 *     career counsellor) — the people who already administer that roster;
 *   * a recruiter, for a student only, when that student is either inside the
 *     recruiter's scoped allow-list (allowed institutions narrowed by the
 *     year / stream / region / state / city limits — the exact filter the
 *     listing endpoints use), or has applied to one of the recruiter's
 *     organization's jobs, which is the student choosing to share.
 *
 * Callers answer an out-of-scope request with 404 rather than 403, so the
 * response does not confirm that a given id exists.
 */
const { Op } = require('sequelize');
const { User, StudentProfile, Organization, Application, Job } = require('../models');
const recruiterAccessService = require('./recruiterAccessService');

const INSTITUTION_STAFF_ROLES = ['tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'];

/** True when the student applied to any job posted by the recruiter's organization. */
async function studentAppliedToOrganization(studentId, organizationId) {
  if (!studentId || !organizationId) return false;
  const hit = await Application.findOne({
    where: { studentId },
    attributes: ['id'],
    include: [{ model: Job, as: 'job', attributes: [], where: { organizationId }, required: true }]
  });
  return !!hit;
}

/**
 * True when the student falls inside the recruiter's allow-list and profile
 * limits. Built from the same pieces getAllUsers uses, so "visible in the
 * listing" and "visible by id" cannot disagree.
 */
async function studentInRecruiterScope(recruiterUserId, studentId) {
  const allowedOrgIds = await recruiterAccessService.getAllowedOrganizationIds(recruiterUserId);
  const where = { id: studentId, role: 'student' };
  recruiterAccessService.applyRecruiterOrgScope(where, allowedOrgIds);
  // applyRecruiterOrgScope forces id = -1 for an empty allow-list; keep that.
  if (where.id === -1) return false;

  const limits = await recruiterAccessService.getRecruiterFilterLimits(recruiterUserId);
  const orgWhere = limits.orgWhere || {};
  const profileWhere = limits.studentProfileWhere || {};
  const include = [];
  if (Object.keys(orgWhere).length) {
    include.push({ model: Organization, as: 'organization', attributes: [], where: orgWhere, required: true });
  }
  if (Object.keys(profileWhere).length) {
    include.push({ model: StudentProfile, as: 'studentProfile', attributes: [], where: profileWhere, required: true });
  }
  const count = await User.count({ where, include, distinct: true, col: 'id' });
  return count > 0;
}

/**
 * Can `viewer` (req.user) see `target`? `target` needs `id`, `role` and
 * `organizationId`; pass a plain id and it is loaded.
 */
async function canViewUser(viewer, target) {
  if (!viewer || !target) return false;
  if (typeof target !== 'object') {
    target = await User.findByPk(target, { attributes: ['id', 'role', 'organizationId'] });
    if (!target) return false;
  }
  if (viewer.id === target.id) return true;
  if (viewer.role === 'admin') return true;

  if (INSTITUTION_STAFF_ROLES.includes(viewer.role)) {
    return !!viewer.organizationId && viewer.organizationId === target.organizationId;
  }

  if (viewer.role === 'recruiter') {
    if (target.role !== 'student') return false;
    if (await studentAppliedToOrganization(target.id, viewer.organizationId)) return true;
    return studentInRecruiterScope(viewer.id, target.id);
  }

  return false;
}

/** Same-institution staff check for write actions (verify, edit) on a student's record. */
function isSameInstitutionStaff(viewer, target) {
  return (
    !!viewer &&
    !!target &&
    INSTITUTION_STAFF_ROLES.includes(viewer.role) &&
    !!viewer.organizationId &&
    viewer.organizationId === target.organizationId
  );
}

module.exports = {
  INSTITUTION_STAFF_ROLES,
  canViewUser,
  isSameInstitutionStaff,
  studentAppliedToOrganization,
  studentInRecruiterScope
};
