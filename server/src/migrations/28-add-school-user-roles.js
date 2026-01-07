// server/src/migrations/28-add-school-user-roles.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new school roles to the users.role ENUM
    // PostgreSQL requires adding ENUM values in a transaction-safe way
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        -- Add 'principal' if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'principal' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'principal';
        END IF;
        
        -- Add 'teacher' if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'teacher' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'teacher';
        END IF;
        
        -- Add 'school_admin' if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'school_admin' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'school_admin';
        END IF;
        
        -- Add 'career_counselor' if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'career_counselor' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'career_counselor';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL does not support removing ENUM values directly
    // This would require recreating the ENUM type, which is complex and risky
    // For safety, we'll leave a comment here
    // In production, you would need to:
    // 1. Create a new ENUM without the values
    // 2. Update all rows to use valid values
    // 3. Drop the old ENUM and rename the new one
    console.log('Warning: Removing ENUM values is not supported in PostgreSQL without data migration');
  }
};

