// server/src/models/PlacementPolicy.js
//
// One institution's rules for who may keep applying once they hold an offer.
// The rules themselves live in utils/placementPolicy.js; this is storage.
module.exports = (sequelize, DataTypes) => {
  const PlacementPolicy = sequelize.define(
    'PlacementPolicy',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'organization_id' },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      // Ordered [{ name, minCtc }] in rupees per annum, lowest first.
      tiers: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      maxOffers: { type: DataTypes.INTEGER, field: 'max_offers', validate: { min: 1 } },
      placedRule: {
        type: DataTypes.ENUM('none', 'higher_tier', 'ctc_multiplier'),
        allowNull: false,
        defaultValue: 'higher_tier',
        field: 'placed_rule'
      },
      ctcMultiplier: { type: DataTypes.DECIMAL(4, 2), field: 'ctc_multiplier' },
      blockAfterAcceptance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'block_after_acceptance' },
      requireVerifiedProfile: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'require_verified_profile' },
      exemptJobIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'exempt_job_ids' },
      updatedBy: { type: DataTypes.INTEGER, field: 'updated_by' }
    },
    { tableName: 'placement_policies', underscored: true, timestamps: true }
  );

  PlacementPolicy.associate = (models) => {
    PlacementPolicy.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
  };

  return PlacementPolicy;
};
