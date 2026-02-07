'use strict';

/**
 * OTP verifications table for registration and forgot-password flows.
 * OTP is stored hashed; 5–10 min expiry; supports rate limiting and audit.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('otp_verifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      identifier: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Email or phone number'
      },
      otp_hash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      purpose: {
        type: Sequelize.ENUM('registration', 'forgot_password'),
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      used_at: {
        type: Sequelize.DATE,
        field: 'used_at'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('otp_verifications', ['identifier', 'purpose']);
    await queryInterface.addIndex('otp_verifications', ['expires_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('otp_verifications');
  }
};
