'use strict';

/**
 * Placement-cell verification of a student's academic record.
 *
 * Eligibility runs on numbers the student typed themselves. Every serious
 * placement portal has the cell check those numbers against marksheets once,
 * and then locks them: a verified CGPA cannot quietly become 8.1 the night
 * before a drive with an 8.0 cut-off.
 *
 *   unverified — never submitted; the student can edit freely
 *   pending    — submitted to the cell; still editable until reviewed
 *   verified   — academic fields locked against student edits
 *   rejected   — sent back with notes; editable again
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('student_profiles');
    if (!table.verification_status) {
      await queryInterface.addColumn('student_profiles', 'verification_status', {
        type: Sequelize.ENUM('unverified', 'pending', 'verified', 'rejected'),
        allowNull: false,
        defaultValue: 'unverified'
      });
    }
    if (!table.verification_notes) {
      await queryInterface.addColumn('student_profiles', 'verification_notes', { type: Sequelize.TEXT, allowNull: true });
    }
    if (!table.verified_by) {
      await queryInterface.addColumn('student_profiles', 'verified_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!table.verified_at) {
      await queryInterface.addColumn('student_profiles', 'verified_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.verification_requested_at) {
      await queryInterface.addColumn('student_profiles', 'verification_requested_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.marksheet_url) {
      // One combined PDF of 10th, 12th/diploma and semester marksheets — what
      // a cell actually asks for at verification time.
      await queryInterface.addColumn('student_profiles', 'marksheet_url', { type: Sequelize.STRING(500), allowNull: true });
    }
  },

  async down(queryInterface) {
    for (const col of ['verification_status', 'verification_notes', 'verified_by', 'verified_at', 'verification_requested_at', 'marksheet_url']) {
      await queryInterface.removeColumn('student_profiles', col).catch(() => {});
    }
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_profiles_verification_status";');
  }
};
