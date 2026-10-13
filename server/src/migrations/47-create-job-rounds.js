'use strict';

/**
 * Selection rounds within a drive, and who is in each one.
 *
 * A campus drive is not one decision: it is an online test, then a technical
 * interview, then HR, each with its own date, venue and shortlist. The single
 * application status could say "interviewed" but not which round, when, or
 * where — which is the one thing a student asks the cell on drive day.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_rounds', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      job_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sequence: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      name: { type: Sequelize.STRING(120), allowNull: false },
      round_type: {
        type: Sequelize.ENUM('aptitude', 'coding', 'group_discussion', 'technical', 'hr', 'other'),
        allowNull: false,
        defaultValue: 'other'
      },
      scheduled_at: { type: Sequelize.DATE, allowNull: true },
      ends_at: { type: Sequelize.DATE, allowNull: true },
      mode: { type: Sequelize.ENUM('on_campus', 'online'), allowNull: false, defaultValue: 'on_campus' },
      venue: { type: Sequelize.STRING(255), allowNull: true },
      meeting_link: { type: Sequelize.STRING(500), allowNull: true },
      instructions: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('job_rounds', ['job_id', 'sequence']);
    await queryInterface.addIndex('job_rounds', ['scheduled_at']);

    await queryInterface.createTable('round_participants', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      round_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'job_rounds', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      application_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'applications', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // Individual interview slot, when the round is split across panels.
      slot_at: { type: Sequelize.DATE, allowNull: true },
      panel: { type: Sequelize.STRING(120), allowNull: true },
      result: {
        type: Sequelize.ENUM('pending', 'cleared', 'not_cleared', 'absent'),
        allowNull: false,
        defaultValue: 'pending'
      },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addConstraint('round_participants', {
      fields: ['round_id', 'application_id'],
      type: 'unique',
      name: 'round_participants_round_application_unique'
    });
    await queryInterface.addIndex('round_participants', ['application_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('round_participants');
    await queryInterface.dropTable('job_rounds');
    for (const t of ['enum_round_participants_result', 'enum_job_rounds_round_type', 'enum_job_rounds_mode', 'enum_job_rounds_status']) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${t}";`);
    }
  }
};
