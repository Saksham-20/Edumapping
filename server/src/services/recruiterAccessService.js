/**
 * Recruiter access control: allowed institutions (schools/colleges/universities).
 * Used by query layer and authorization. Manual API tampering must fail.
 */
const { RecruiterProfile, RecruiterAllowedOrganization, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Returns array of organization IDs the recruiter is allowed to access.
 * Empty array = no access (recruiter must not see any students from institutions).
 */
async function getAllowedOrganizationIds(recruiterUserId) {
  if (!recruiterUserId) return [];
  const profile = await RecruiterProfile.findOne({
    where: { userId: recruiterUserId },
    include: [{
      model: RecruiterAllowedOrganization,
      as: 'allowedOrganizations',
      attributes: ['organizationId']
    }]
  });
  if (!profile || !profile.allowedOrganizations || profile.allowedOrganizations.length === 0) {
    return [];
  }
  return profile.allowedOrganizations.map(a => a.organizationId);
}

/**
 * Apply recruiter scope to user whereClause: restrict to allowed organization IDs only.
 * If allowedIds is empty, add impossible condition so query returns no rows.
 */
function applyRecruiterOrgScope(whereClause, allowedOrgIds) {
  if (!Array.isArray(allowedOrgIds) || allowedOrgIds.length === 0) {
    whereClause.organizationId = null;
    whereClause.id = -1;
    return;
  }
  whereClause.organizationId = { [Op.in]: allowedOrgIds };
}

/**
 * Optional: apply additional recruiter limits (year, stream, region, etc.) from profile.
 * Returns an object { studentProfileWhere, orgWhere } to merge into include where clauses.
 */
async function getRecruiterFilterLimits(recruiterUserId) {
  if (!recruiterUserId) return {};
  const profile = await RecruiterProfile.findOne({
    where: { userId: recruiterUserId },
    attributes: ['allowedYears', 'allowedStreams', 'allowedRegions', 'allowedStates', 'allowedCities']
  });
  if (!profile) return {};
  const studentProfileWhere = {};
  const orgWhere = {};
  if (profile.allowedYears && profile.allowedYears.length) {
    studentProfileWhere.yearOfStudy = { [Op.in]: profile.allowedYears };
  }
  if (profile.allowedStreams && profile.allowedStreams.length) {
    studentProfileWhere.branch = { [Op.in]: profile.allowedStreams };
  }
  if (profile.allowedRegions && profile.allowedRegions.length) {
    orgWhere.region = { [Op.in]: profile.allowedRegions };
  }
  if (profile.allowedStates && profile.allowedStates.length) {
    orgWhere.state = { [Op.in]: profile.allowedStates };
  }
  if (profile.allowedCities && profile.allowedCities.length) {
    orgWhere.city = { [Op.in]: profile.allowedCities };
  }
  return { studentProfileWhere, orgWhere };
}

/**
 * Companies that recruit at an institution: the organisations of every
 * recruiter whose allow-list (recruiter_allowed_organizations) names it.
 * The same relationship that lets the institution's TPO review the company's
 * postings and lets the company see the institution's students.
 */
async function companyIdsRecruitingAt(institutionOrganizationId) {
  if (!institutionOrganizationId) return [];
  const rows = await RecruiterAllowedOrganization.findAll({
    where: { organizationId: institutionOrganizationId },
    attributes: ['id'],
    include: [{
      model: RecruiterProfile,
      as: 'recruiterProfile',
      attributes: ['id'],
      required: true,
      include: [{ model: User, as: 'user', attributes: ['organizationId'], required: true }]
    }]
  });
  return [...new Set(rows.map((r) => r.recruiterProfile.user.organizationId).filter(Boolean))];
}

// Members of an institution: what they see of the job board is scoped to it.
// Recruiters, TPOs and admins manage postings and keep their own rules in
// jobController.
const JOB_SCOPED_ROLES = ['student', 'principal', 'teacher', 'school_admin', 'career_counselor'];

/** Whether GET /jobs and GET /jobs/:id scope this caller (anonymous included). */
const isJobScopedViewer = (user) => !user || JOB_SCOPED_ROLES.includes(user.role);

/**
 * Organisations whose live drives a student (or other institution member) may
 * see: their own institution (a drive its TPO posted) and every company with a
 * recruiter allowed at that institution. Drives used to be visible to every
 * student on the platform, so a company allowed at one college reached, and
 * took applications from, students of colleges that never admitted it.
 */
async function visibleJobOrganizationIds(user) {
  if (!user || !user.organizationId) return [];
  const companies = await companyIdsRecruitingAt(user.organizationId);
  return [...new Set([user.organizationId, ...companies])];
}

/**
 * A Sequelize `where` fragment for the jobs a student may see. Combine it with
 * other filters under Op.and — it constrains `organizationId`, which a caller's
 * own `?organizationId=` filter must not overwrite. No organisation (or no
 * user) yields a condition that matches nothing.
 */
async function studentVisibleJobWhere(user) {
  const ids = await visibleJobOrganizationIds(user);
  return {
    status: 'active',
    organizationId: ids.length ? { [Op.in]: ids } : -1
  };
}

/**
 * The institutions a job is open to — the inverse of visibleJobOrganizationIds,
 * for fanning out alerts: the posting organisation itself (a college's own
 * drive) plus every institution on the allow-list of any recruiter of the
 * posting company.
 */
async function jobAudienceOrganizationIds(job) {
  if (!job || !job.organizationId) return [];
  const rows = await RecruiterAllowedOrganization.findAll({
    attributes: ['organizationId'],
    include: [{
      model: RecruiterProfile,
      as: 'recruiterProfile',
      attributes: ['id'],
      required: true,
      include: [{ model: User, as: 'user', attributes: [], where: { organizationId: job.organizationId }, required: true }]
    }]
  });
  return [...new Set([job.organizationId, ...rows.map((r) => r.organizationId)])];
}

/**
 * The placement cell of one or more institutions: ids of their active TPOs.
 * Used to tell the cell about drives awaiting its approval and about offers
 * and offer letters for its students.
 */
async function tpoUserIdsFor(organizationIds) {
  const ids = (Array.isArray(organizationIds) ? organizationIds : [organizationIds]).filter(Boolean);
  if (!ids.length) return [];
  const rows = await User.findAll({
    where: { role: 'tpo', isActive: true, organizationId: { [Op.in]: ids } },
    attributes: ['id']
  });
  return rows.map((u) => u.id);
}

/** Whether this student (or institution member) may see this job at all. */
async function canStudentSeeJob(user, job) {
  if (!job || job.status !== 'active') return false;
  const ids = await visibleJobOrganizationIds(user);
  return ids.includes(job.organizationId);
}

module.exports = {
  getAllowedOrganizationIds,
  applyRecruiterOrgScope,
  getRecruiterFilterLimits,
  companyIdsRecruitingAt,
  visibleJobOrganizationIds,
  studentVisibleJobWhere,
  canStudentSeeJob,
  jobAudienceOrganizationIds,
  tpoUserIdsFor,
  isJobScopedViewer,
  JOB_SCOPED_ROLES
};
