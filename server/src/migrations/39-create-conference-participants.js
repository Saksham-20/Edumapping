'use strict';

/**
 * Per-user state inside a conference.
 *
 * This table is the authority for two things LiveKit cannot know about:
 *   1. `role`   — host / cohost / attendee, which decides the token grants.
 *   2. `is_banned` / `is_hard_muted` — moderation decisions that must SURVIVE
 *      a page reload.
 *
 * LiveKit's removeParticipant({ revokeTokenTs }) invalidates the token a
 * kicked user is holding, but it cannot stop our own API from minting a fresh
 * one on their next request. The token endpoint therefore reads `is_banned`
 * here before issuing anything.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conference_participants', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      conference_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'conferences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.ENUM('host', 'cohost', 'attendee'),
        allowNull: false,
        defaultValue: 'attendee'
      },
      is_banned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Kicked by a host — token endpoint refuses to mint a new token'
      },
      banned_at: {
        type: Sequelize.DATE
      },
      is_hard_muted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Host revoked publish rights; survives rejoin'
      },
      hand_raised_at: {
        type: Sequelize.DATE,
        comment: 'Null when the hand is lowered; ordering column for the queue'
      },
      first_joined_at: { type: Sequelize.DATE },
      last_joined_at: { type: Sequelize.DATE },
      last_left_at: { type: Sequelize.DATE },
      total_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Accumulated attendance, updated from LiveKit webhooks'
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.addIndex('conference_participants', ['conference_id']);
    await queryInterface.addIndex('conference_participants', ['user_id']);
    await queryInterface.addConstraint('conference_participants', {
      fields: ['conference_id', 'user_id'],
      type: 'unique',
      name: 'conference_participants_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conference_participants');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conference_participants_role";');
  }
};
