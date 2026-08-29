'use strict';

/**
 * Live classes / conferences.
 *
 * A conference is a LiveKit room plus the EduMapping authorisation rules that
 * decide who may join it and with which capabilities. `room_name` is the
 * identifier handed to LiveKit and must be globally unique.
 *
 * Optionally linked to an event, so an existing scheduled event can host its
 * session in-platform instead of relying on an external meeting link.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conferences', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      room_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique LiveKit room identifier'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      host_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Organization the conference belongs to; null = platform-wide'
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'events', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'live', 'ended', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      scheduled_start: {
        type: Sequelize.DATE
      },
      scheduled_end: {
        type: Sequelize.DATE
      },
      started_at: {
        type: Sequelize.DATE
      },
      ended_at: {
        type: Sequelize.DATE
      },
      // Room policy. Defaults encode the classroom model: only hosts and
      // co-hosts send video, attendees are audio-only and may raise a hand.
      allow_attendee_video: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      allow_attendee_screen_share: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      allow_attendee_audio: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'When false, attendees join listen-only'
      },
      mute_on_entry: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      allow_chat: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      // Access scope: who is allowed to request a token at all.
      access: {
        type: Sequelize.ENUM('organization', 'registered', 'invite', 'public'),
        allowNull: false,
        defaultValue: 'organization',
        comment: 'organization = same org; registered = event registrants; invite = explicit participant rows; public = any authenticated user'
      },
      max_participants: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
        comment: 'Capacity guard — sized for the host VPS, not a LiveKit limit'
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.addIndex('conferences', ['room_name'], {
      unique: true,
      name: 'conferences_room_name_unique'
    });
    await queryInterface.addIndex('conferences', ['host_user_id']);
    await queryInterface.addIndex('conferences', ['organization_id']);
    await queryInterface.addIndex('conferences', ['event_id']);
    await queryInterface.addIndex('conferences', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conferences');
    // Postgres keeps ENUM types after the table is dropped.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conferences_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conferences_access";');
  }
};
