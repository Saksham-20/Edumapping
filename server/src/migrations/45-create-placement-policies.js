'use strict';

/**
 * A placement cell's rules for who may keep applying once they hold an offer.
 *
 * Every Indian placement policy has some form of "one student, one job":
 * companies are banded into tiers by CTC (Regular / Dream / Super Dream), a
 * placed student may only apply upward, and there is a cap on offers held.
 * Until now the only lever was a manual sanction per student, so a cell had to
 * police the rule by hand across hundreds of applications.
 *
 * One row per institution. `tiers` is an ordered list of
 * { name, minCtc } in rupees per annum; `exempt_job_ids` are "open" drives the
 * cell has explicitly let everyone apply to regardless of offers held.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('placement_policies', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tiers: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      max_offers: { type: Sequelize.INTEGER, allowNull: true },
      placed_rule: {
        type: Sequelize.ENUM('none', 'higher_tier', 'ctc_multiplier'),
        allowNull: false,
        defaultValue: 'higher_tier'
      },
      ctc_multiplier: { type: Sequelize.DECIMAL(4, 2), allowNull: true },
      block_after_acceptance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      require_verified_profile: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      exempt_job_ids: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('placement_policies');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_placement_policies_placed_rule";');
  }
};
