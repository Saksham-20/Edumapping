// Script to seed school organizations and students
const bcrypt = require('bcryptjs');
const { User, Organization } = require('./src/models');
const { Op } = require('sequelize');

async function seedSchools() {
  try {
    // Get admin user for approved_by
    const admin = await User.findOne({ where: { role: 'admin' } });
    const approvedBy = admin ? admin.id : null;
    
    // Find school organizations (create if they don't exist, but handle ID conflicts)
    let dps = await Organization.findOne({ 
      where: { 
        [Op.or]: [
          { name: 'Delhi Public School' },
          { contactEmail: 'admin@dpsdelhi.edu.in' }
        ]
      } 
    });
    
    if (!dps) {
      // Try to find any school organization and use next ID
      const allOrgs = await Organization.findAll({ order: [['id', 'DESC']], limit: 1 });
      const nextId = allOrgs.length > 0 ? allOrgs[0].id + 1 : 5;
      
      try {
        dps = await Organization.create({
          id: nextId,
          name: 'Delhi Public School',
          type: 'school',
          domain: 'admin@dpsdelhi.edu.in',
          logoUrl: 'https://via.placeholder.com/150x150/FF8C42/FFFFFF?text=DPS',
          contactEmail: 'admin@dpsdelhi.edu.in',
          contactPhone: '+91-11-12345678',
          website: 'https://dpsdelhi.edu.in',
          address: 'Mathura Road, New Delhi, Delhi 110076',
          isVerified: true,
          approvalStatus: 'approved',
          approvedBy: approvedBy,
          approvedAt: new Date()
        }, { validate: false });
        console.log('✅ Created Delhi Public School (ID:', dps.id, ')');
      } catch (err) {
        // If still fails, just find by type
        dps = await Organization.findOne({ where: { type: 'school', name: { [Op.like]: '%Delhi%' } } });
        if (!dps) {
          console.log('⚠️  Could not create DPS, will use first available school organization');
          dps = await Organization.findOne({ where: { type: 'school' } });
        }
      }
    }
    
    if (!dps) {
      console.log('❌ No school organization found. Please create one manually.');
      process.exit(1);
    }
    
    console.log('✅ Using Delhi Public School (ID:', dps.id, ')');
    
    let kv = await Organization.findOne({ 
      where: { 
        [Op.and]: [
          { type: 'school' },
          { id: { [Op.ne]: dps.id } },
          { [Op.or]: [
            { name: 'Kendriya Vidyalaya No. 1' },
            { contactEmail: 'principal@kv1mumbai.edu.in' },
            { name: { [Op.like]: '%Kendriya%' } }
          ]}
        ]
      } 
    });
    
    if (!kv) {
      // Use any other school organization or create
      const allOrgs = await Organization.findAll({ order: [['id', 'DESC']], limit: 1 });
      const nextId = allOrgs.length > 0 ? allOrgs[0].id + 1 : 6;
      
      try {
        kv = await Organization.create({
          id: nextId,
          name: 'Kendriya Vidyalaya No. 1',
          type: 'school',
          domain: 'principal@kv1mumbai.edu.in',
          logoUrl: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=KV',
          contactEmail: 'principal@kv1mumbai.edu.in',
          contactPhone: '+91-22-23456789',
          website: 'https://kv1mumbai.edu.in',
          address: 'Andheri West, Mumbai, Maharashtra 400053',
          isVerified: true,
          approvalStatus: 'approved',
          approvedBy: approvedBy,
          approvedAt: new Date()
        }, { validate: false });
        console.log('✅ Created Kendriya Vidyalaya No. 1 (ID:', kv.id, ')');
      } catch (err) {
        kv = await Organization.findOne({ 
          where: { 
            type: 'school',
            id: { [Op.ne]: dps.id }
          } 
        });
      }
    }
    
    if (!kv) {
      console.log('⚠️  Only one school organization found. Using it for all students.');
      kv = dps; // Use same org for KV students
    }
    
    console.log('✅ Using Kendriya Vidyalaya No. 1 (ID:', kv.id, ')');
    
    const passwordHash = await bcrypt.hash('password123', 12);
    
    // Create or update school students
    const schoolStudents = [
      {
        email: 'rahul.sharma@dpsdelhi.edu.in',
        passwordHash: passwordHash,
        role: 'student',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '+919876543210',
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
        phone: '+919876543211',
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
        phone: '+919876543212',
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
        phone: '+919876543213',
        profilePicture: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=AS',
        organizationId: kv.id,
        isActive: true,
        isVerified: true,
        approvalStatus: 'approved',
        approvedBy: approvedBy,
        approvedAt: new Date()
      }
    ];
    
    console.log('\n📝 Creating/updating school students...');
    for (const student of schoolStudents) {
      const existingUser = await User.findOne({ where: { email: student.email } });
      
      if (existingUser) {
        // Update existing user
        await existingUser.update(student, { validate: false });
        console.log(`✅ Updated: ${student.email}`);
      } else {
        // Create new user - find next available ID
        const lastUser = await User.findOne({ order: [['id', 'DESC']] });
        const nextId = lastUser ? lastUser.id + 1 : 9;
        
        try {
          const newUser = await User.create({
            id: nextId,
            ...student
          }, { validate: false });
          console.log(`✅ Created: ${student.email} (ID: ${newUser.id})`);
        } catch (err) {
          // If ID conflict, try without specifying ID
          const newUser = await User.create(student, { validate: false });
          console.log(`✅ Created: ${student.email} (ID: ${newUser.id})`);
        }
      }
    }
    
    console.log('\n✅ School organizations and students seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Delhi Public School:');
    console.log('  - rahul.sharma@dpsdelhi.edu.in / password123');
    console.log('  - priya.patel@dpsdelhi.edu.in / password123');
    console.log('Kendriya Vidyalaya No. 1:');
    console.log('  - arjun.kumar@kv1mumbai.edu.in / password123');
    console.log('  - ananya.singh@kv1mumbai.edu.in / password123');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

seedSchools();

