// server/src/utils/placementPolicy.js
//
// The "one student, one job" rules a placement cell publishes every season,
// enforced instead of policed by hand.
//
// A policy belongs to the student's institution, not to the company: the same
// Infosys drive can be open to a placed student at one college and closed to
// them at another. This module is pure — callers load the policy, the job and
// the student's offers, and decide what to do with the verdict.

/**
 * The tier presets most Indian engineering colleges use. The CTC bands are a
 * starting point the cell edits, not a recommendation.
 */
const DEFAULT_TIERS = [
  { name: 'Regular', minCtc: 0 },
  { name: 'Dream', minCtc: 600000 },
  { name: 'Super Dream', minCtc: 1200000 }
];

const DEFAULT_POLICY = {
  enabled: false,
  tiers: DEFAULT_TIERS,
  maxOffers: 2,
  placedRule: 'higher_tier',
  ctcMultiplier: null,
  blockAfterAcceptance: false,
  requireVerifiedProfile: false,
  exemptJobIds: []
};

/**
 * Annual CTC for a job, in rupees. Postings store a range; the top of the range
 * is what a student is being offered the chance at, and what every published
 * tier rule is written against.
 */
const jobCtc = (job) => {
  const max = Number(job?.salaryMax) || 0;
  const min = Number(job?.salaryMin) || 0;
  const value = Math.max(max, min);
  // Recruiters sometimes type "12" meaning 12 LPA. Anything under 1,000 is read
  // that way, the same convention the client's salary formatter uses.
  return value > 0 && value < 1000 ? value * 100000 : value;
};

/** Normalise stored tiers: valid entries only, sorted ascending by CTC. */
const normaliseTiers = (tiers) =>
  (Array.isArray(tiers) ? tiers : [])
    .map((t) => ({ name: String(t?.name || '').trim(), minCtc: Math.max(0, Number(t?.minCtc) || 0) }))
    .filter((t) => t.name)
    .sort((a, b) => a.minCtc - b.minCtc);

/** Index of the highest tier whose floor the CTC clears; -1 when no tiers. */
const tierIndexFor = (ctc, tiers) => {
  let idx = -1;
  tiers.forEach((t, i) => {
    if (ctc >= t.minCtc) idx = i;
  });
  return idx;
};

const tierFor = (ctc, tiers) => {
  const list = normaliseTiers(tiers);
  const i = tierIndexFor(ctc, list);
  return i >= 0 ? list[i] : null;
};

const formatLpa = (ctc) => {
  const l = ctc / 100000;
  return `₹${Number.isInteger(l) ? l : l.toFixed(1)} LPA`;
};

/**
 * Decide whether the policy lets this student apply to this job.
 *
 * @param policy   PlacementPolicy row (or plain object) — may be null
 * @param job      Job with salaryMin/salaryMax and id
 * @param offers   the student's offers, any status, each with `ctc` and `status`
 * @param profile  StudentProfile (for verification status) — may be null
 * @returns { allowed, reasons, tier }
 */
const evaluatePolicy = (policy, job, offers = [], profile = null) => {
  const reasons = [];
  const tiers = normaliseTiers(policy?.tiers);
  const ctc = jobCtc(job);
  const tier = tierIndexFor(ctc, tiers) >= 0 ? tiers[tierIndexFor(ctc, tiers)] : null;

  if (!policy || !policy.enabled) return { allowed: true, reasons, tier };

  if (policy.requireVerifiedProfile && profile && profile.verificationStatus !== 'verified') {
    reasons.push(
      'Your placement cell must verify your academic details before you can apply. Submit them for verification from your profile.'
    );
  }

  // Internships run as their own cycle under every Indian placement policy we
  // have seen: holding a job offer does not stop a student taking a summer
  // internship, and a stipend is not comparable with an annual CTC.
  const exempt =
    job?.jobType === 'internship' || (policy.exemptJobIds || []).map(Number).includes(Number(job?.id));
  const live = offers.filter((o) => o.status === 'offered' || o.status === 'accepted');

  if (!exempt && live.length > 0) {
    if (policy.blockAfterAcceptance && live.some((o) => o.status === 'accepted')) {
      reasons.push('You have accepted an offer, so your placement cell has closed further applications for you.');
    }

    if (policy.maxOffers && live.length >= policy.maxOffers) {
      reasons.push(
        `Your placement cell allows at most ${policy.maxOffers} offer${policy.maxOffers === 1 ? '' : 's'} per student, and you hold ${live.length}.`
      );
    }

    const best = Math.max(...live.map((o) => Number(o.ctc) || 0));
    if (policy.placedRule === 'higher_tier' && tiers.length > 0) {
      const held = tierIndexFor(best, tiers);
      const target = tierIndexFor(ctc, tiers);
      if (target <= held) {
        const heldName = held >= 0 ? tiers[held].name : 'a';
        reasons.push(
          `You already hold a ${heldName} offer. Under your placement policy you can only apply to a higher tier${
            tiers[held + 1] ? ` (${tiers[held + 1].name}, from ${formatLpa(tiers[held + 1].minCtc)})` : ''
          }.`
        );
      }
    } else if (policy.placedRule === 'ctc_multiplier' && Number(policy.ctcMultiplier) > 0) {
      const need = best * Number(policy.ctcMultiplier);
      if (ctc < need) {
        reasons.push(
          `You already hold an offer of ${formatLpa(best)}. Your placement policy requires at least ${formatLpa(need)} (${Number(
            policy.ctcMultiplier
          )}×) to apply again.`
        );
      }
    }
  }

  return { allowed: reasons.length === 0, reasons, tier };
};

/**
 * Load everything evaluatePolicy needs for one student, from the models.
 * Returns the verdict; never throws for a missing policy.
 */
const checkPolicyForStudent = async (models, { studentId, organizationId, job, profile }) => {
  const { PlacementPolicy, Offer } = models;
  if (!organizationId) return { allowed: true, reasons: [], tier: null };
  const policy = await PlacementPolicy.findOne({ where: { organizationId } });
  if (!policy || !policy.enabled) return { allowed: true, reasons: [], tier: tierFor(jobCtc(job), policy?.tiers) };
  const offers = await Offer.findAll({ where: { studentId }, attributes: ['id', 'ctc', 'status'] });
  return evaluatePolicy(policy, job, offers, profile);
};

module.exports = {
  DEFAULT_TIERS,
  DEFAULT_POLICY,
  jobCtc,
  normaliseTiers,
  tierFor,
  evaluatePolicy,
  checkPolicyForStudent
};
