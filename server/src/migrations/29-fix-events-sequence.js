'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Fixing events table auto-increment sequence...');

    try {
      const [result] = await queryInterface.sequelize.query(`
        SELECT MAX(id) as max_id FROM events;
      `);

      const maxId = result[0]?.max_id || 0;
      const nextId = maxId + 1;

      console.log(`  Current max ID: ${maxId}`);
      console.log(`  Setting sequence to start from: ${nextId}`);

      await queryInterface.sequelize.query(`
        SELECT setval(pg_get_serial_sequence('events', 'id'), ${nextId}, false);
      `);

      console.log('✅ Events sequence fixed successfully');
    } catch (error) {
      console.error('❌ Error fixing events sequence:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('⚠️  This migration cannot be reversed automatically');
  }
};

