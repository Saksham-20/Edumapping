// server/src/services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Organization } = require('../models');
const logger = require('../utils/logger');

class AuthService {
  async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  generateTokens(userId) {
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not set in environment variables');
      throw new Error('Server configuration error: JWT secret is missing');
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      logger.error('JWT_REFRESH_SECRET is not set in environment variables');
      throw new Error('Server configuration error: JWT refresh secret is missing');
    }

    try {
      const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '1h' }
      );

      const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
      );

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Error generating tokens', error, { userId });
      throw new Error('Failed to generate authentication tokens');
    }
  }

  async verifyRefreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async register(userData) {
    try {
      const { email, password, role, organizationId, ...profileData } = userData;
      
      logger.debug('Registration attempt', { email, role, organizationId: organizationId || 'none' });

  // Check if user exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Validate organization if provided
  if (organizationId) {
    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      throw new Error('Invalid organization');
    }
    
    // Students can belong to universities (colleges) or schools
    // TPOs can only belong to universities (colleges)
    // School roles (principal, teacher, school_admin, career_counselor) can only belong to schools
    if (role === 'student' && organization.type !== 'university' && organization.type !== 'school') {
      throw new Error('Students can only belong to university or school organizations');
    }
    if (role === 'tpo' && organization.type !== 'university') {
      throw new Error('TPOs can only belong to university organizations');
    }
    
    // Recruiters must belong to company organizations
    if (role === 'recruiter' && organization.type !== 'company') {
      throw new Error('Recruiters can only belong to company organizations');
    }
    
    // School roles must belong to school organizations
    if ((role === 'principal' || role === 'teacher' || role === 'school_admin' || role === 'career_counselor') && organization.type !== 'school') {
      throw new Error('School roles can only belong to school organizations');
    }
  } else if (role !== 'admin') {
    // Non-admin users must have an organization
    throw new Error('Organization is required for this role');
  }

  // Hash password
  const passwordHash = await this.hashPassword(password);

      // Clean up phone number - convert empty string to null
    const cleanedProfileData = { ...profileData };
    if (cleanedProfileData.phone === '') {
      cleanedProfileData.phone = null;
    }

    // Determine approval status based on role
    let approvalStatus = 'pending';
    let isActive = false;
    
    if (role === 'admin') {
      // Admin is auto-approved and active
      approvalStatus = 'approved';
      isActive = true;
    } else if (role === 'student' || role === 'tpo') {
      // Students and TPOs are auto-approved
      approvalStatus = 'approved';
      isActive = true;
    } else if (role === 'recruiter') {
      // Recruiters are auto-approved for now (can be changed later for manual approval)
      approvalStatus = 'approved';
      isActive = true;
    } else if (role === 'principal' || role === 'teacher' || role === 'school_admin' || role === 'career_counselor') {
      // School roles are auto-approved
      approvalStatus = 'approved';
      isActive = true;
    }

    // Create user
    let user;
    try {
      user = await User.create({
        email,
        passwordHash,
        role,
        organizationId,
        approvalStatus,
        isActive,
        isVerified: false,
        ...cleanedProfileData
      });
    } catch (createError) {
      // Check if it's an invalid ENUM value error
      if (createError.name === 'SequelizeDatabaseError' && 
          (createError.parent?.message?.includes('invalid input value for enum') ||
           createError.parent?.message?.includes('enum_users_role'))) {
        throw new Error(`Invalid role "${role}". The database may need to be updated with the latest migrations. Please contact support.`);
      }
      throw createError;
    }

  // Generate tokens
  const tokens = this.generateTokens(user.id);

      // Reload user with organization to ensure it's included in response
      const userWithOrg = await User.findByPk(user.id, {
        include: [
          {
            model: Organization,
            as: 'organization',
            required: false
          }
        ],
        attributes: { exclude: ['passwordHash'] }
      });

      if (!userWithOrg) {
        logger.error('User not found after creation', { userId: user.id, email });
        throw new Error('User created but could not be retrieved. Please try logging in.');
      }

      // Return user without password
      const { passwordHash: _, ...userWithoutPassword } = userWithOrg.toJSON();

      logger.debug('Registration successful', { userId: user.id, email, role });
      
      return {
        user: userWithoutPassword,
        tokens
      };
    } catch (error) {
      logger.error('Registration error', error, { 
        email: userData?.email, 
        role: userData?.role,
        errorName: error.name,
        errorMessage: error.message 
      });
      throw error;
    }
  }

  async login(email, password) {
    logger.auth('login', null, false, { email: logger.sanitize.email(email) });
    
    try {
      // First, find user by email (regardless of isActive status)
      const user = await User.findOne({
        where: { email },
        include: [
          {
            model: Organization,
            as: 'organization'
          }
        ]
      });
      
      logger.debug('User lookup for login', { 
        found: !!user, 
        userId: user?.id,
        role: user?.role,
        isActive: user?.isActive,
        approvalStatus: user?.approvalStatus
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active and approved
      if (!user.isActive) {
        if (user.approvalStatus === 'pending') {
          throw new Error('Your account is pending approval. Please wait for TPO/Admin approval before logging in.');
        } else if (user.approvalStatus === 'rejected') {
          throw new Error('Your account has been rejected. Please contact support for more information.');
        } else {
          throw new Error('Your account has been disabled. Please contact support for more information.');
        }
      }

    // Verify password
    const isValidPassword = await this.comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    // Return user without password
    const { passwordHash: _, ...userWithoutPassword } = user.toJSON();

    logger.auth('login', user.id, true, { role: user.role });

    return {
      user: userWithoutPassword,
      tokens
    };
    } catch (error) {
      logger.auth('login', null, false, { error: error.message });
      throw error;
    }
  }

  async refreshTokens(refreshToken) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    return this.generateTokens(user.id);
  }

  async logout(userId) {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return success
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token (in production, save this in database with expiry)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send email (implement email service)
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetToken, newPassword) {
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }

      const user = await User.findByPk(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const passwordHash = await this.hashPassword(newPassword);
      await user.update({ passwordHash });

      return { message: 'Password reset successfully' };
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await this.comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await user.update({ passwordHash });

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();