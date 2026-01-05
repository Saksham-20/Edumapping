// server/src/migrations/27-add-school-organization-type.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'school' to the organization type ENUM
    // PostgreSQL uses ALTER TYPE ... ADD VALUE to add values to ENUM types
    // We use a DO block to safely check and add the value
    
    await queryInterface.sequelize.query(`
      DO $$ 
      DECLARE
        enum_type_name text;
      BEGIN
        -- Find the enum type name that contains 'university'
        SELECT t.typname INTO enum_type_name
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE e.enumlabel = 'university'
        LIMIT 1;
        
        -- If we found the enum type, check if 'school' exists and add it if not
        IF enum_type_name IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            WHERE enumlabel = 'school' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = enum_type_name)
          ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_type_name, 'school');
          END IF;
        ELSE
          -- Fallback: try the default Sequelize naming convention
          BEGIN
            ALTER TYPE "enum_organizations_type" ADD VALUE 'school';
          EXCEPTION
            WHEN duplicate_object THEN
              -- Value already exists, which is fine
              NULL;
          END;
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from ENUM types directly
    // This would require recreating the ENUM type, which is complex and risky
    // For safety, we'll just log a warning
    // 
    // If you really need to remove it, you would need to:
    // 1. Update all rows with type='school' to another value (e.g., 'university')
    // 2. Create a new ENUM without 'school'
    // 3. Alter the column to use the new ENUM
    // 4. Drop the old ENUM
    // This is not implemented here for safety reasons
    
    console.warn('PostgreSQL does not support removing ENUM values. Manual intervention required if rollback is needed.');
  }
};

