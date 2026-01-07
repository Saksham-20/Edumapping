// server/check-enum-roles.js
const { sequelize } = require('./src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    const [results] = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role') 
      ORDER BY enumlabel;
    `);
    
    console.log('\nAvailable roles in database:');
    results.forEach(r => console.log(`  - ${r.enumlabel}`));
    
    const expectedRoles = ['admin', 'career_counselor', 'principal', 'recruiter', 'school_admin', 'student', 'teacher', 'tpo'];
    const dbRoles = results.map(r => r.enumlabel);
    const missingRoles = expectedRoles.filter(r => !dbRoles.includes(r));
    
    if (missingRoles.length > 0) {
      console.log('\n⚠️  Missing roles:', missingRoles.join(', '));
      console.log('   Run: npx sequelize-cli db:migrate');
    } else {
      console.log('\n✅ All expected roles are present in the database.');
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

