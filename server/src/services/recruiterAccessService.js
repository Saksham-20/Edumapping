/**
 * Recruiter access control: allowed institutions (schools/colleges/universities).
 * Used by query layer and authorization. Manual API tampering must fail.
 */
const { RecruiterProfile, RecruiterAllowedOrganization } = require('../models');
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

module.exports = {
  getAllowedOrganizationIds,
  applyRecruiterOrgScope,
  getRecruiterFilterLimits
};
