
// server/src/seeders/02-users.js
'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const passwordHash = await bcrypt.hash('password123', 12);
    
    await queryInterface.bulkInsert('users', [
      // Admin user
      {
        id: 1,
        email: 'admin@edumapping.com',
        password_hash: passwordHash,
        role: 'admin',
        first_name: 'System',
        last_name: 'Administrator',
        phone: '+1-555-0001',
        profile_picture: 'https://via.placeholder.com/150x150/6B7280/FFFFFF?text=SA',
        organization_id: null,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: null, // Admin approves themselves
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      // TPO user
      {
        id: 2,
        email: 'tpo@techuniversity.edu',
        password_hash: passwordHash,
        role: 'tpo',
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '+1-555-0002',
        profile_picture: 'https://via.placeholder.com/150x150/8B5CF6/FFFFFF?text=JS',
        organization_id: 1,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      // Recruiter users
      {
        id: 3,
        email: 'recruiter@techcorp.com',
        password_hash: passwordHash,
        role: 'recruiter',
        first_name: 'Michael',
        last_name: 'Johnson',
        phone: '+1-555-0003',
        profile_picture: 'https://via.placeholder.com/150x150/EC4899/FFFFFF?text=MJ',
        organization_id: 2,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        email: 'hr@startupxyz.io',
        password_hash: passwordHash,
        role: 'recruiter',
        first_name: 'Sarah',
        last_name: 'Williams',
        phone: '+1-555-0004',
        profile_picture: 'https://via.placeholder.com/150x150/14B8A6/FFFFFF?text=SW',
        organization_id: 3,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      // Student users
      {
        id: 5,
        email: 'john.doe@techuniversity.edu',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1-555-0005',
        profile_picture: 'https://via.placeholder.com/000000/FFFFFF?text=JD',
        organization_id: 1,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 6,
        email: 'alice.wilson@techuniversity.edu',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Alice',
        last_name: 'Wilson',
        phone: '+1-555-0006',
        profile_picture: 'https://via.placeholder.com/150x150/F97316/FFFFFF?text=AW',
        organization_id: 1,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 7,
        email: 'bob.martinez@gec.edu',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Bob',
        last_name: 'Martinez',
        phone: '+1-555-0007',
        profile_picture: 'https://via.placeholder.com/150x150/84CC16/FFFFFF?text=BM',
        organization_id: 4,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 8,
        email: 'emma.davis@techuniversity.edu',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Emma',
        last_name: 'Davis',
        phone: '+1-555-0008',
        profile_picture: 'https://via.placeholder.com/150x150/A855F7/FFFFFF?text=ED',
        organization_id: 1,
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1, // Approved by admin
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      // School students
      {
        id: 9,
        email: 'rahul.sharma@dpsdelhi.edu.in',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Rahul',
        last_name: 'Sharma',
        phone: '+91-9876543210',
        profile_picture: 'https://via.placeholder.com/150x150/FF8C42/FFFFFF?text=RS',
        organization_id: 5, // Delhi Public School
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 10,
        email: 'priya.patel@dpsdelhi.edu.in',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Priya',
        last_name: 'Patel',
        phone: '+91-9876543211',
        profile_picture: 'https://via.placeholder.com/150x150/FF8C42/FFFFFF?text=PP',
        organization_id: 5, // Delhi Public School
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 11,
        email: 'arjun.kumar@kv1mumbai.edu.in',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Arjun',
        last_name: 'Kumar',
        phone: '+91-9876543212',
        profile_picture: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=AK',
        organization_id: 6, // Kendriya Vidyalaya No. 1
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 12,
        email: 'ananya.singh@kv1mumbai.edu.in',
        password_hash: passwordHash,
        role: 'student',
        first_name: 'Ananya',
        last_name: 'Singh',
        phone: '+91-9876543213',
        profile_picture: 'https://via.placeholder.com/150x150/138808/FFFFFF?text=AS',
        organization_id: 6, // Kendriya Vidyalaya No. 1
        is_active: true,
        is_verified: true,
        approval_status: 'approved',
        approved_by: 1,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
