// server/src/models/ConferenceParticipant.js
module.exports = (sequelize, DataTypes) => {
  const ConferenceParticipant = sequelize.define('ConferenceParticipant', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    conferenceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'conference_id',
      references: { model: 'conferences', key: 'id' }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' }
    },
    role: {
      type: DataTypes.ENUM('host', 'cohost', 'attendee'),
      allowNull: false,
      defaultValue: 'attendee'
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_banned'
    },
    bannedAt: { type: DataTypes.DATE, field: 'banned_at' },
    isHardMuted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_hard_muted'
    },
    handRaisedAt: { type: DataTypes.DATE, field: 'hand_raised_at' },
    firstJoinedAt: { type: DataTypes.DATE, field: 'first_joined_at' },
    lastJoinedAt: { type: DataTypes.DATE, field: 'last_joined_at' },
    lastLeftAt: { type: DataTypes.DATE, field: 'last_left_at' },
    totalSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_seconds'
    }
  }, {
    tableName: 'conference_participants',
    underscored: true,
    timestamps: true
  });

  ConferenceParticipant.associate = (models) => {
    ConferenceParticipant.belongsTo(models.Conference, {
      foreignKey: 'conferenceId',
      as: 'conference'
    });
    ConferenceParticipant.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ConferenceParticipant;
};
