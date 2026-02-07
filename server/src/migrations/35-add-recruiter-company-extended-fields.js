'use strict';

/**
 * Phase 5: Extend recruiter/company model - multiple locations, work mode.
 * Do not remove old fields.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const rp = await queryInterface.describeTable('recruiter_profiles');
    if (!rp.work_mode) {
      await queryInterface.addColumn('recruiter_profiles', 'work_mode', {
        type: Sequelize.STRING(20)
      });
    }
    if (!rp.locations) {
      await queryInterface.addColumn('recruiter_profiles', 'locations', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
    if (!rp.hiring_regions) {
      await queryInterface.addColumn('recruiter_profiles', 'hiring_regions', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }

    const org = await queryInterface.describeTable('organizations');
    if (!org.work_mode) {
      await queryInterface.addColumn('organizations', 'work_mode', {
        type: Sequelize.STRING(20)
      });
    }
    if (!org.locations) {
      await queryInterface.addColumn('organizations', 'locations', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const rp = await queryInterface.describeTable('recruiter_profiles');
    if (rp.hiring_regions) await queryInterface.removeColumn('recruiter_profiles', 'hiring_regions');
    if (rp.locations) await queryInterface.removeColumn('recruiter_profiles', 'locations');
    if (rp.work_mode) await queryInterface.removeColumn('recruiter_profiles', 'work_mode');
    const org = await queryInterface.describeTable('organizations');
    if (org.locations) await queryInterface.removeColumn('organizations', 'locations');
    if (org.work_mode) await queryInterface.removeColumn('organizations', 'work_mode');
  }
};
