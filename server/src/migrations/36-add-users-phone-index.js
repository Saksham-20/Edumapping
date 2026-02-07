'use strict';

/**
 * Phase 6: Index for login-by-phone and filter performance.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('users', ['phone'], {
      name: 'users_phone_idx'
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_phone_idx').catch(() => {});
  }
};
