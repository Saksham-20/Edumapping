'use strict';

/**
 * Adds `jobs.view_count`.
 *
 * The recruiter dashboard has always rendered a "Total Views" tile and a
 * conversion rate derived from `job.viewCount`, but no such column existed —
 * both numbers were permanently zero. This backs them with real data.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'view_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jobs', 'view_count');
  }
};
