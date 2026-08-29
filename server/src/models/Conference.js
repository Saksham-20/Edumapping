// server/src/models/Conference.js
module.exports = (sequelize, DataTypes) => {
  const Conference = sequelize.define('Conference', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    roomName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'room_name'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    hostUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'host_user_id',
      references: { model: 'users', key: 'id' }
    },
    organizationId: {
      type: DataTypes.INTEGER,
      field: 'organization_id',
      references: { model: 'organizations', key: 'id' }
    },
    eventId: {
      type: DataTypes.INTEGER,
      field: 'event_id',
      references: { model: 'events', key: 'id' }
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'live', 'ended', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled'
    },
    scheduledStart: { type: DataTypes.DATE, field: 'scheduled_start' },
    scheduledEnd: { type: DataTypes.DATE, field: 'scheduled_end' },
    startedAt: { type: DataTypes.DATE, field: 'started_at' },
    endedAt: { type: DataTypes.DATE, field: 'ended_at' },

    allowAttendeeVideo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'allow_attendee_video'
    },
    allowAttendeeScreenShare: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'allow_attendee_screen_share'
    },
    allowAttendeeAudio: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_attendee_audio'
    },
    muteOnEntry: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'mute_on_entry'
    },
    allowChat: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'allow_chat'
    },
    access: {
      type: DataTypes.ENUM('organization', 'registered', 'invite', 'public'),
      allowNull: false,
      defaultValue: 'organization'
    },
    maxParticipants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      field: 'max_participants'
    }
  }, {
    tableName: 'conferences',
    underscored: true,
    timestamps: true
  });

  Conference.associate = (models) => {
    Conference.belongsTo(models.User, { foreignKey: 'hostUserId', as: 'host' });
    Conference.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    Conference.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
    Conference.hasMany(models.ConferenceParticipant, {
      foreignKey: 'conferenceId',
      as: 'participants'
    });
  };

  return Conference;
};
