// server/fix-events-sequence.js
// Utility script to fix Postgres auto-increment sequence for events table.
// Usage: node fix-events-sequence.js

require('dotenv').config();
const { sequelize } = require('./src/models');

async function fixEventsSequence() {
  console.log('🔧 Fixing events table auto-increment sequence...');

  try {
    const [result] = await sequelize.query(`SELECT MAX(id) as max_id FROM events;`);
    const maxId = result[0]?.max_id || 0;
    const nextId = maxId + 1;

    console.log(`  Current max ID: ${maxId}`);
    console.log(`  Setting sequence to start from: ${nextId}`);

    await sequelize.query(`
      SELECT setval(pg_get_serial_sequence('events', 'id'), ${nextId}, false);
    `);

    console.log('✅ Events sequence fixed successfully');
  } catch (error) {
    console.error('❌ Error fixing events sequence:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

fixEventsSequence();

