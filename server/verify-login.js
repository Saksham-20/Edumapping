// Quick script to verify login credentials
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function verifyLogin(email, password) {
  try {
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log('❌ User not found:', email);
      return;
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      approvalStatus: user.approvalStatus
    });
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (isValid) {
      console.log('✅ Password is CORRECT');
    } else {
      console.log('❌ Password is INCORRECT');
      console.log('Expected password: password123');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

// Get email and password from command line
const email = process.argv[2] || 'admin@edumapping.com';
const password = process.argv[3] || 'password123';

console.log('Verifying login for:', email);
verifyLogin(email, password);

