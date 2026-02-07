'use strict';

/**
 * Add location hierarchy to organizations: region, state, city, zone.
 * Supports geographic filtering for institutions.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('organizations');

    if (!tableDescription.region) {
      await queryInterface.addColumn('organizations', 'region', {
        type: Sequelize.STRING(100)
      });
    }
    if (!tableDescription.state) {
      await queryInterface.addColumn('organizations', 'state', {
        type: Sequelize.STRING(100)
      });
    }
    if (!tableDescription.city) {
      await queryInterface.addColumn('organizations', 'city', {
        type: Sequelize.STRING(100)
      });
    }
    if (!tableDescription.zone) {
      await queryInterface.addColumn('organizations', 'zone', {
        type: Sequelize.STRING(100)
      });
    }

    await queryInterface.addIndex('organizations', ['region']).catch(() => {});
    await queryInterface.addIndex('organizations', ['state']).catch(() => {});
    await queryInterface.addIndex('organizations', ['city']).catch(() => {});
    await queryInterface.addIndex('organizations', ['zone']).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('organizations');
    if (tableDescription.zone) await queryInterface.removeColumn('organizations', 'zone');
    if (tableDescription.city) await queryInterface.removeColumn('organizations', 'city');
    if (tableDescription.state) await queryInterface.removeColumn('organizations', 'state');
    if (tableDescription.region) await queryInterface.removeColumn('organizations', 'region');
  }
};
