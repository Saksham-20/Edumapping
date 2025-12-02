// server/src/migrations/26-fix-users-sequence.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Fixing users table auto-increment sequence...');
    
    try {
      // Get the maximum ID from the users table
      const [result] = await queryInterface.sequelize.query(`
        SELECT MAX(id) as max_id FROM users;
      `);
      
      const maxId = result[0]?.max_id || 0;
      const nextId = maxId + 1;
      
      console.log(`  Current max ID: ${maxId}`);
      console.log(`  Setting sequence to start from: ${nextId}`);
      
      // Reset the sequence to be one higher than the max ID
      await queryInterface.sequelize.query(`
        SELECT setval(pg_get_serial_sequence('users', 'id'), ${nextId}, false);
      `);
      
      console.log('✅ Users sequence fixed successfully');
    } catch (error) {
      console.error('❌ Error fixing users sequence:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // This migration cannot be easily reversed
    console.log('⚠️  This migration cannot be reversed automatically');
  }
};









