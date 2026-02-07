'use strict';

/**
 * Add 'college' to organization type enum (school, college, university as institution types).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        enum_type_name text;
      BEGIN
        SELECT t.typname INTO enum_type_name
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE e.enumlabel = 'university'
        LIMIT 1;
        IF enum_type_name IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'college'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = enum_type_name)
        ) THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_type_name, 'college');
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    console.warn('PostgreSQL does not support removing ENUM values. Rollback skipped for organization type.');
  }
};
