'use strict';

/**
 * Recruiter access control: which institutions (schools/colleges/universities) a recruiter can access.
 * Enforced in query layer and authorization middleware.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recruiter_allowed_organizations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      recruiter_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'recruiter_profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.addIndex('recruiter_allowed_organizations', ['recruiter_profile_id']);
    await queryInterface.addIndex('recruiter_allowed_organizations', ['organization_id']);
    await queryInterface.addConstraint('recruiter_allowed_organizations', {
      fields: ['recruiter_profile_id', 'organization_id'],
      type: 'unique',
      name: 'recruiter_allowed_organizations_unique'
    });

    const tableDescription = await queryInterface.describeTable('recruiter_profiles');
    if (!tableDescription.max_institutions) {
      await queryInterface.addColumn('recruiter_profiles', 'max_institutions', {
        type: Sequelize.INTEGER,
        comment: 'Cap on number of allowed institutions (optional)'
      });
    }
    if (!tableDescription.allowed_years) {
      await queryInterface.addColumn('recruiter_profiles', 'allowed_years', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
    if (!tableDescription.allowed_streams) {
      await queryInterface.addColumn('recruiter_profiles', 'allowed_streams', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
    if (!tableDescription.allowed_regions) {
      await queryInterface.addColumn('recruiter_profiles', 'allowed_regions', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
    if (!tableDescription.allowed_states) {
      await queryInterface.addColumn('recruiter_profiles', 'allowed_states', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
    if (!tableDescription.allowed_cities) {
      await queryInterface.addColumn('recruiter_profiles', 'allowed_cities', {
        type: Sequelize.JSON,
        defaultValue: []
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('recruiter_profiles');
    if (tableDescription.allowed_cities) await queryInterface.removeColumn('recruiter_profiles', 'allowed_cities');
    if (tableDescription.allowed_states) await queryInterface.removeColumn('recruiter_profiles', 'allowed_states');
    if (tableDescription.allowed_regions) await queryInterface.removeColumn('recruiter_profiles', 'allowed_regions');
    if (tableDescription.allowed_streams) await queryInterface.removeColumn('recruiter_profiles', 'allowed_streams');
    if (tableDescription.allowed_years) await queryInterface.removeColumn('recruiter_profiles', 'allowed_years');
    if (tableDescription.max_institutions) await queryInterface.removeColumn('recruiter_profiles', 'max_institutions');
    await queryInterface.dropTable('recruiter_allowed_organizations');
  }
};
