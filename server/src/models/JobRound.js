// server/src/models/JobRound.js
//
// One selection round of a drive (online test, GD, technical, HR …) with its
// own schedule and venue. Who is in the round lives in RoundParticipant.
module.exports = (sequelize, DataTypes) => {
  const JobRound = sequelize.define(
    'JobRound',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      jobId: { type: DataTypes.INTEGER, allowNull: false, field: 'job_id' },
      // The campus this round runs at; null means wherever the job runs.
      organizationId: { type: DataTypes.INTEGER, field: 'organization_id' },
      sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      name: { type: DataTypes.STRING(120), allowNull: false, validate: { len: [1, 120] } },
      roundType: {
        type: DataTypes.ENUM('aptitude', 'coding', 'group_discussion', 'technical', 'hr', 'other'),
        allowNull: false,
        defaultValue: 'other',
        field: 'round_type'
      },
      scheduledAt: { type: DataTypes.DATE, field: 'scheduled_at' },
      endsAt: { type: DataTypes.DATE, field: 'ends_at' },
      mode: { type: DataTypes.ENUM('on_campus', 'online'), allowNull: false, defaultValue: 'on_campus' },
      venue: { type: DataTypes.STRING(255) },
      meetingLink: { type: DataTypes.STRING(500), field: 'meeting_link' },
      instructions: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      createdBy: { type: DataTypes.INTEGER, field: 'created_by' }
    },
    { tableName: 'job_rounds', underscored: true, timestamps: true }
  );

  JobRound.associate = (models) => {
    JobRound.belongsTo(models.Job, { foreignKey: 'jobId', as: 'job' });
    JobRound.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    JobRound.hasMany(models.RoundParticipant, { foreignKey: 'roundId', as: 'participants', onDelete: 'CASCADE' });
  };

  return JobRound;
};
