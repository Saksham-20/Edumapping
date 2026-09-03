// server/src/utils/placementStatus.js
//
// One definition of "placed", used everywhere.
//
// There were briefly two: applications counted a student placed when any
// application reached `selected`, and offers counted them placed when they held
// a live offer. Those disagree exactly where it matters — a revoked offer
// leaves the application still marked `selected`, so the application-based rule
// would quietly put the student back to placed and prop up the placement rate
// with an offer that no longer exists.
//
// The rule, in order:
//
//   1. `deferred` is a decision by the student or the cell. Never overwritten.
//   2. A live offer — outstanding or accepted — means placed. A declined or
//      revoked one does not.
//   3. Otherwise a `selected` application with no offer recorded against it
//      still counts. Offers are new; selections made before them, or by a cell
//      that has not recorded the package yet, are real placements and must not
//      silently disappear the day this shipped.

const { Op } = require('sequelize');

const syncPlacementStatus = async (studentId, models) => {
  const { StudentProfile, Application, Offer } = models;

  const profile = await StudentProfile.findOne({ where: { userId: studentId } });
  if (!profile || profile.placementStatus === 'deferred') return;

  const liveOffers = await Offer.count({
    where: { studentId, status: { [Op.in]: Offer.LIVE_STATUSES } }
  });

  let placed = liveOffers > 0;

  if (!placed) {
    // Selected applications that have no offer attached at all. An application
    // whose offer was revoked is deliberately excluded — that outcome has been
    // recorded and reversed.
    const selected = await Application.findAll({
      where: { studentId, status: 'selected' },
      attributes: ['id']
    });
    if (selected.length > 0) {
      const withOffers = await Offer.count({
        where: { applicationId: { [Op.in]: selected.map((a) => a.id) } }
      });
      placed = withOffers < selected.length;
    }
  }

  const next = placed ? 'placed' : 'unplaced';
  if (profile.placementStatus !== next) {
    await profile.update({ placementStatus: next });
  }
  return next;
};

module.exports = { syncPlacementStatus };
