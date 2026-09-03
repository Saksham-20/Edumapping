'use strict';

/**
 * Sanctions on a student's placement participation.
 *
 * The only lever was `users.is_active`, which is an account switch: turning it
 * off stops the student signing in at all. Every published Indian placement
 * policy has a debarment clause, and what a placement cell actually wants is
 * narrower and reversible — stop this student taking new drives, without
 * ending the interview they are already in the middle of, and without locking
 * them out of the portal they need in order to read why.
 *
 * Three states, because the cell distinguishes them:
 *
 *   none    — participating
 *   blocked — cannot apply to anything new; in-flight applications continue.
 *             The usual response to missed drives, and normally temporary.
 *   removed — out of placements for the season. In-flight applications stop
 *             counting too, and the student is not chased for drives.
 *
 * A reason is mandatory in the API, not here, since existing rows have none.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('student_profiles');

    if (!table.placement_sanction) {
      await queryInterface.addColumn('student_profiles', 'placement_sanction', {
        type: Sequelize.ENUM('none', 'blocked', 'removed'),
        allowNull: false,
        defaultValue: 'none'
      });
    }
    if (!table.sanction_reason) {
      await queryInterface.addColumn('student_profiles', 'sanction_reason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!table.sanction_until) {
      // A block that nobody remembers to lift becomes a permanent one. An
      // expiry is how a temporary sanction stays temporary.
      await queryInterface.addColumn('student_profiles', 'sanction_until', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }
    if (!table.sanctioned_by) {
      await queryInterface.addColumn('student_profiles', 'sanctioned_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!table.sanctioned_at) {
      await queryInterface.addColumn('student_profiles', 'sanctioned_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('student_profiles');
    for (const name of [
      'sanctioned_at',
      'sanctioned_by',
      'sanction_until',
      'sanction_reason',
      'placement_sanction'
    ]) {
      if (table[name]) await queryInterface.removeColumn('student_profiles', name);
    }
    await queryInterface.sequelize
      .query('DROP TYPE IF EXISTS "enum_student_profiles_placement_sanction";')
      .catch(() => {});
  }
};
