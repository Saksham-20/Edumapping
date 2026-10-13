// server/src/utils/approvalCascade.js
//
// What happens to the people attached to an organization when the
// organization itself is approved or rejected.
//
// There were three copies of this decision and they disagreed:
//
//   * the TPO approval endpoints approved a company's pending recruiters with a
//     static `User.update`. Static updates do not run instance hooks, and the
//     User model derives `isActive` from `approvalStatus` in `beforeUpdate` —
//     so every recruiter approved this way came out `approved` but
//     `isActive: false`, and the login check refused them. The company was
//     "approved" and nobody at it could sign in.
//   * the admin verify endpoint approved the organization and nobody at all,
//     so the TPO who registered a new college sat in `pending` forever behind
//     an approved institution.
//
// One function now owns it. It writes `isActive` explicitly rather than relying
// on a hook, so it is correct whether or not hooks run, and it records who
// decided and when on every row it touches.

const { Op } = require('sequelize');

const SCHOOL_STAFF_ROLES = ['principal', 'teacher', 'school_admin', 'career_counselor'];

/**
 * The roles that speak for an organization of a given type — the accounts
 * that were waiting on the organization's own approval. Students are not in
 * any of these lists: they join an existing institution and are approved on
 * signup (see authService.register).
 */
const STAFF_ROLES_BY_ORG_TYPE = {
  company: ['recruiter'],
  university: ['tpo'],
  college: ['tpo'],
  school: SCHOOL_STAFF_ROLES
};

const INSTITUTION_TYPES = ['university', 'college', 'school'];

/**
 * Who may decide on an organization.
 *
 * A TPO vets the companies that want to recruit from campus. An institution is
 * a different matter — approving a university creates a new tenant whose TPO
 * then controls student data — so only an administrator may do that. This
 * used to be unrestricted: any TPO could approve any pending university.
 */
const canDecideOrganization = (actor, organization) => {
  if (!actor || !organization) return false;
  if (actor.role === 'admin') return true;
  if (actor.role === 'tpo') return organization.type === 'company';
  return false;
};

/**
 * Who may decide on an individual account. Admins: anyone but another admin
 * (admins are created, never self-registered). TPOs: recruiters only, the same
 * scope as the company decision above.
 */
const canDecideUser = (actor, target) => {
  if (!actor || !target) return false;
  if (target.role === 'admin') return false;
  if (actor.role === 'admin') return true;
  if (actor.role === 'tpo') return target.role === 'recruiter';
  return false;
};

/**
 * Apply an organization decision to its waiting staff accounts.
 *
 * Approve: every PENDING staff account becomes approved and active. Reject:
 * every pending one becomes rejected and inactive — leaving them pending
 * against a rejected organization would park them on the "awaiting approval"
 * screen indefinitely. Accounts that were already decided individually are
 * left alone either way.
 *
 * Returns the number of accounts changed.
 */
const cascadeOrganizationDecision = async (
  { User, organization, action, approverId, notes = null, transaction }
) => {
  const roles = STAFF_ROLES_BY_ORG_TYPE[organization.type] || [];
  if (roles.length === 0) return 0;

  const approved = action === 'approve';
  const [count] = await User.update(
    {
      approvalStatus: approved ? 'approved' : 'rejected',
      // Explicit, not hook-derived: this is a static update.
      isActive: approved,
      approvedBy: approverId,
      approvedAt: new Date(),
      approvalNotes: notes
    },
    {
      where: {
        organizationId: organization.id,
        role: { [Op.in]: roles },
        approvalStatus: 'pending'
      },
      transaction
    }
  );
  return count;
};

module.exports = {
  SCHOOL_STAFF_ROLES,
  STAFF_ROLES_BY_ORG_TYPE,
  INSTITUTION_TYPES,
  canDecideOrganization,
  canDecideUser,
  cascadeOrganizationDecision
};
