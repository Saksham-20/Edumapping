'use strict';

/**
 * Fix: otp_verifications.updated_at is NOT NULL but model uses updatedAt: false.
 * Sequelize does not send updated_at on INSERT; add DEFAULT so inserts succeed.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE otp_verifications
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE otp_verifications
      ALTER COLUMN updated_at DROP DEFAULT;
    `);
  }
};
