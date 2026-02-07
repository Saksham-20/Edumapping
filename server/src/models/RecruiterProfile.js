// server/src/models/RecruiterProfile.js
module.exports = (sequelize, DataTypes) => {
  const RecruiterProfile = sequelize.define('RecruiterProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    department: {
      type: DataTypes.STRING(100)
    },
    position: {
      type: DataTypes.STRING(100)
    },
    bio: {
      type: DataTypes.TEXT
    },
    experience: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    linkedinUrl: {
      type: DataTypes.STRING(255),
      field: 'linkedin_url',
      validate: {
        isUrl: true
      }
    },
    maxInstitutions: {
      type: DataTypes.INTEGER,
      field: 'max_institutions'
    },
    allowedYears: { type: DataTypes.JSON, field: 'allowed_years', defaultValue: [] },
    allowedStreams: { type: DataTypes.JSON, field: 'allowed_streams', defaultValue: [] },
    allowedRegions: { type: DataTypes.JSON, field: 'allowed_regions', defaultValue: [] },
    allowedStates: { type: DataTypes.JSON, field: 'allowed_states', defaultValue: [] },
    allowedCities: { type: DataTypes.JSON, field: 'allowed_cities', defaultValue: [] },
    workMode: { type: DataTypes.STRING(20), field: 'work_mode' },
    locations: { type: DataTypes.JSON, defaultValue: [] },
    hiringRegions: { type: DataTypes.JSON, field: 'hiring_regions', defaultValue: [] }
  }, {
    tableName: 'recruiter_profiles',
    underscored: true,
    timestamps: true
  });

  RecruiterProfile.associate = (models) => {
    RecruiterProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    RecruiterProfile.hasMany(models.RecruiterAllowedOrganization, {
      foreignKey: 'recruiterProfileId',
      as: 'allowedOrganizations'
    });
  };

  return RecruiterProfile;
};