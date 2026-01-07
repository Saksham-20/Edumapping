// Script to seed only school students
const bcrypt = require('bcryptjs');
const { User, Organization } = require('./src/models');

async function seedSchoolStudents() {
  try {
    // Check if organizations exist
    const dps = await Organization.findOne({ where: { name: 'Delhi Public School' } });
    const kv = await Organization.findOne({ where: { name: 'Kendriya Vidyalaya No. 1' } });
    
    if (!dps || !kv) {
      console.log('❌ School organizations not found. Please run full seed first.');
      process.exit(1);
    }
    
    console.log('✅ School organizations found');
    console.log('DPS ID:', dps.id);
    console.log('KV ID:', kv.id);
    
    const passwordHash = await bcrypt.hash('password123', 12);
    
    // Check if users already exist
    const existingUsers = await User.findAll({
      where: {
        email: [
          'rahul.sharma@dpsdelhi.edu.in',
          'priya.patel@dpsdelhi.edu.in',
          'arjun.kumar@kv1mumbai.edu.in',
          'ananya.singh@kv1mumbai.edu.in'
        ]
      }
    });
    
    if (existingUsers.length > 0) {
      console.log('⚠️  Some school students already exist. Deleting them first...');
      await User.destroy({
        where: {
          email: [
            'rahul.sharma@dpsdelhi.edu.in',
            'priya.patel@dpsdelhi.edu.in',
            'arjun.kumar@kv1mumbai.edu.in',
            'ananya.singh@kv1mumbai.edu.in'
          ]
        }
      });
    }
    
    // Get admin user for approved_by
    const admin = await User.findOne({ where: { role: 'admin' } });
    const approvedBy = admin ? admin.id : null;
    
    // Create school students
    const schoolStudents = [
      {
        email: 'rahul.sharma@dpsdelhi.edu.in',
        passwordHash: passwordHash,
        role: 'student',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '+91-9876543210',
        profilePicture: 'https://via.placeholder.com/150x150/FF8C42/FFFFFF?text=RS',
        organizationId: dps.id,
        isActive: true,
        isVerified: true,
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvedAt: new Date()
      },
      {
        email: 'priya.patel@dpsdelhi.edu.in',
        passwordHash: passwordHash,
        role: 'student',
        firstName: 'Priya',
        lastName: 'Patel',
        phone: '+91-9876543211',
        profilePicture: 'https://via.placeholder.com/150x150/FF8C42/FFFFFF?text=PP',
        organizationId: dps.id,
        isActive: true,
        isVerified: true,
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvedAt: new Date()
      },
      {
        email: 'arjun.kumar@kv1mumbai.edu.in',
        passwordHash: passwordHash,
        role: 'student',
        firstName: 'Arjun',
        lastName: 'Kumar',
        phone: '+91-9876543212',
        profilePicture: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=AK',
        organizationId: kv.id,
        isActive: true,
        isVerified: true,
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvedAt: new Date()
      },
      {
        email: 'ananya.singh@kv1mumbai.edu.in',
        passwordHash: passwordHash,
        role: 'student',
        firstName: 'Ananya',
        lastName: 'Singh',
        phone: '+91-9876543213',
        profilePicture: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=AS',
        organizationId: kv.id,
        isActive: true,
        isVerified: true,
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvedAt: new Date()
      }
    ];
    
    for (const student of schoolStudents) {
      const [user, created] = await User.findOrCreate({
        where: { email: student.email },
        defaults: student
      });
      
      if (created) {
        console.log(`✅ Created: ${student.email}`);
      } else {
        // Update existing user
        await user.update(student);
        console.log(`✅ Updated: ${student.email}`);
      }
    }
    
    console.log('\n✅ School students seeded successfully!');
    console.log('\nYou can now login with:');
    console.log('- rahul.sharma@dpsdelhi.edu.in / password123');
    console.log('- priya.patel@dpsdelhi.edu.in / password123');
    console.log('- arjun.kumar@kv1mumbai.edu.in / password123');
    console.log('- ananya.singh@kv1mumbai.edu.in / password123');
    
  } catch (error) {
    console.error('❌ Error seeding school students:', error);
  }
  
  process.exit(0);
}

seedSchoolStudents();


