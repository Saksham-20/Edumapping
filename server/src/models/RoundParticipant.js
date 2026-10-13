// server/src/models/RoundParticipant.js
//
// An application's place in one round: its slot, panel and result.
module.exports = (sequelize, DataTypes) => {
  const RoundParticipant = sequelize.define(
    'RoundParticipant',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      roundId: { type: DataTypes.INTEGER, allowNull: false, field: 'round_id' },
      applicationId: { type: DataTypes.INTEGER, allowNull: false, field: 'application_id' },
      slotAt: { type: DataTypes.DATE, field: 'slot_at' },
      panel: { type: DataTypes.STRING(120) },
      result: {
        type: DataTypes.ENUM('pending', 'cleared', 'not_cleared', 'absent'),
        allowNull: false,
        defaultValue: 'pending'
      },
      remarks: { type: DataTypes.TEXT }
    },
    {
      tableName: 'round_participants',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['round_id', 'application_id'], name: 'round_participants_round_application_unique' }]
    }
  );

  RoundParticipant.associate = (models) => {
    RoundParticipant.belongsTo(models.JobRound, { foreignKey: 'roundId', as: 'round' });
    RoundParticipant.belongsTo(models.Application, { foreignKey: 'applicationId', as: 'application' });
  };

  return RoundParticipant;
};
