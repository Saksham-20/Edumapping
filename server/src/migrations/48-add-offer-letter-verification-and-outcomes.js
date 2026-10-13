'use strict';

/**
 * Evidence behind a placement, and outcomes that are not a job.
 *
 * NAAC peer teams sample placement records and ask for the signed offer letter
 * behind each one, so an offer now records whether the cell has checked its
 * letter. Separately, NIRF scores "placement and higher studies" together and
 * reports students who opted out: `placed / unplaced / deferred` could not say
 * that a student left for an M.Tech, so those students counted as failures.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const offers = await queryInterface.describeTable('offers');
    if (!offers.letter_verified) {
      await queryInterface.addColumn('offers', 'letter_verified', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    }
    if (!offers.letter_verified_by) {
      await queryInterface.addColumn('offers', 'letter_verified_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
    if (!offers.letter_verified_at) {
      await queryInterface.addColumn('offers', 'letter_verified_at', { type: Sequelize.DATE, allowNull: true });
    }

    // ALTER TYPE … ADD VALUE cannot run inside a transaction block on older
    // Postgres, so each runs on its own.
    await queryInterface.sequelize.query(`ALTER TYPE "enum_student_profiles_placement_status" ADD VALUE IF NOT EXISTS 'higher_studies';`);
    await queryInterface.sequelize.query(`ALTER TYPE "enum_student_profiles_placement_status" ADD VALUE IF NOT EXISTS 'opted_out';`);
  },

  async down(queryInterface) {
    for (const col of ['letter_verified', 'letter_verified_by', 'letter_verified_at']) {
      await queryInterface.removeColumn('offers', col).catch(() => {});
    }
    // Postgres cannot drop enum values; the two outcomes stay in the type.
  }
};
