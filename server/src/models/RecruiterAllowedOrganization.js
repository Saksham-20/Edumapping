// server/src/models/RecruiterAllowedOrganization.js
module.exports = (sequelize, DataTypes) => {
  const RecruiterAllowedOrganization = sequelize.define('RecruiterAllowedOrganization', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    recruiterProfileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'recruiter_profile_id',
      references: { model: 'recruiter_profiles', key: 'id' }
    },
    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'organization_id',
      references: { model: 'organizations', key: 'id' }
    }
  }, {
    tableName: 'recruiter_allowed_organizations',
    underscored: true,
    timestamps: true
  });

  RecruiterAllowedOrganization.associate = (models) => {
    RecruiterAllowedOrganization.belongsTo(models.RecruiterProfile, {
      foreignKey: 'recruiterProfileId',
      as: 'recruiterProfile'
    });
    RecruiterAllowedOrganization.belongsTo(models.Organization, {
      foreignKey: 'organizationId',
      as: 'organization'
    });
  };

  return RecruiterAllowedOrganization;
};
