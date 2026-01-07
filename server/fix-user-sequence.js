// Fix PostgreSQL sequence for users table
const { Sequelize } = require('sequelize');
const config = require('./src/config/database');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: false,
});

async function fixUserSequence() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Get the maximum ID from the users table
    const [results] = await sequelize.query(`
      SELECT MAX(id) as max_id FROM users;
    `);
    
    const maxId = results[0]?.max_id || 0;
    console.log(`Current maximum user ID: ${maxId}`);

    // Reset the sequence to be one more than the max ID
    const nextId = maxId + 1;
    await sequelize.query(`
      SELECT setval('users_id_seq', ${nextId}, false);
    `);

    console.log(`✅ Sequence reset to ${nextId}. Next user will get ID ${nextId}.`);

    // Verify the sequence
    const [seqResults] = await sequelize.query(`
      SELECT last_value, is_called FROM users_id_seq;
    `);
    
    console.log('Sequence status:', seqResults[0]);
    
  } catch (error) {
    console.error('Error fixing sequence:', error);
  } finally {
    await sequelize.close();
  }
}

fixUserSequence();

