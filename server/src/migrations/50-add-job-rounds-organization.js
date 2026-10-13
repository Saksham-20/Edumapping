'use strict';

/**
 * Which campus a round belongs to.
 *
 * One posting runs at many colleges, and the online test at one campus is not
 * the online test at another — different dates, venues and shortlists. A round
 * a TPO schedules belongs to their institution; one a recruiter schedules with
 * no institution applies wherever the job runs.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('job_rounds');
    if (!table.organization_id) {
      await queryInterface.addColumn('job_rounds', 'organization_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('job_rounds', 'organization_id');
  }
};
