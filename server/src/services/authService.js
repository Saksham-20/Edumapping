// server/src/services/authService.js
const { httpError } = require('../utils/appError');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { User, Organization, OtpVerification } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
const OTP_LENGTH = 6;

class AuthService {
  _generateOtp() {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  async _hashOtp(otp) {
    const saltRounds = 10;
    return await bcrypt.hash(otp, saltRounds);
  }

  async _verifyOtp(otp, otpHash) {
    return await bcrypt.compare(otp, otpHash);
  }

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
      throw httpError(401, 'Invalid refresh token');
    }
  }

  async register(userData) {
    try {
      const { email, otp, password, role, organizationId, ...profileData } = userData;
      const normalizedEmail = email && email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw httpError(400, 'Email is required');
      }
      if (otp) {
        await this.verifyRegistrationOtp(normalizedEmail, otp);
      }
      logger.debug('Registration attempt', { email: normalizedEmail, role, organizationId: organizationId || 'none' });

  // Check if user exists
  const existingUser = await User.findOne({ where: { email: { [Op.iLike]: normalizedEmail } } });
  if (existingUser) {
    throw httpError(409, 'User already exists with this email');
  }

  // Validate organization if provided
  if (organizationId) {
    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      throw httpError(400, 'Invalid organization');
    }
    
    // Students: university, college, or school. TPOs: university or college. School roles: school only.
    if (role === 'student' && !['university', 'college', 'school'].includes(organization.type)) {
      throw httpError(400, 'Students can only belong to university, college, or school organizations');
    }
    if (role === 'tpo' && organization.type !== 'university' && organization.type !== 'college') {
      throw httpError(400, 'TPOs can only belong to university or college organizations');
    }
    
    // Recruiters must belong to company organizations
    if (role === 'recruiter' && organization.type !== 'company') {
      throw httpError(400, 'Recruiters can only belong to company organizations');
    }
    
    // School roles must belong to school organizations
    if ((role === 'principal' || role === 'teacher' || role === 'school_admin' || role === 'career_counselor') && organization.type !== 'school') {
      throw httpError(400, 'School roles can only belong to school organizations');
    }
  } else if (role !== 'admin') {
    // Non-admin users must have an organization
    throw httpError(400, 'Organization is required for this role');
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
        email: normalizedEmail,
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
        throw httpError(400, `Invalid role "${role}". The database may need to be updated with the latest migrations. Please contact support.`);
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

  /**
   * Find user by identifier (email or phone). Supports legacy login with email only.
   */
  async _findUserByIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    const trimmed = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    // Phone lookup strips separators from BOTH sides.
    //
    // It used to be an exact string match, so whether you could sign in
    // depended on punctuation: seeded rows store "+1-555-0005" while the model
    // now normalises new numbers to "+15550005", and a user typing their own
    // number with spaces or hyphens matched neither. Comparing the digits
    // makes every spelling of the same number work regardless of how the row
    // happens to be stored.
    if (isEmail) {
      return await User.findOne({
        where: { email: { [Op.iLike]: trimmed } },
        include: [{ model: Organization, as: 'organization' }]
      });
    }

    const digits = trimmed.replace(/[^0-9]/g, '');
    if (!digits) return null;

    // Numbers are stored with a country code, but people type their own number
    // without one — "9876543210" matched nothing while "+919876543210" signed
    // in fine. When the identifier carries no "+", the digits are matched as a
    // suffix so either spelling works.
    //
    // `phone` is not unique, and a suffix can in principle match more than one
    // account across country codes. Logging somebody into whichever row came
    // back first would be a serious failure, so an ambiguous match is treated
    // as no match at all: an exact identifier still works, and nobody is signed
    // in as the wrong person.
    const normalized = fn('regexp_replace', col('phone'), '[^0-9]', '', 'g');
    const where = trimmed.includes('+')
      ? sequelizeWhere(normalized, digits)
      : sequelizeWhere(normalized, { [Op.like]: `%${digits}` });

    const matches = await User.findAll({
      where,
      include: [{ model: Organization, as: 'organization' }],
      limit: 2
    });
    if (matches.length !== 1) {
      if (matches.length > 1) {
        logger.warn('Ambiguous phone identifier at login', { matched: matches.length });
      }
      return null;
    }
    return matches[0];
  }

  async login(identifierOrEmail, password) {
    const identifier = identifierOrEmail && identifierOrEmail.trim();
    logger.auth('login', null, false, { identifier: identifier ? (identifier.includes('@') ? logger.sanitize.email(identifier) : 'phone') : 'missing' });
    
    try {
      const user = await this._findUserByIdentifier(identifier);
      
      logger.debug('User lookup for login', { 
        found: !!user, 
        userId: user?.id,
        role: user?.role,
        isActive: user?.isActive,
        approvalStatus: user?.approvalStatus
      });

      if (!user) {
        throw httpError(401, 'Invalid credentials');
      }

      // Check if user is active and approved
      if (!user.isActive) {
        if (user.approvalStatus === 'pending') {
          throw httpError(403, 'Your account is pending approval. Please wait for TPO/Admin approval before logging in.');
        } else if (user.approvalStatus === 'rejected') {
          throw httpError(403, 'Your account has been rejected. Please contact support for more information.');
        } else {
          throw httpError(403, 'Your account has been disabled. Please contact support for more information.');
        }
      }

    // Verify password
    const isValidPassword = await this.comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw httpError(401, 'Invalid credentials');
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
      throw httpError(401, 'User not found or inactive');
    }

    return this.generateTokens(user.id);
  }

  async logout(userId) {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return success
    return { message: 'Logged out successfully' };
  }

  async sendRegistrationOtp(email) {
    const normalizedEmail = email && email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw httpError(400, 'Valid email is required');
    }
    const existingUser = await User.findOne({ where: { email: { [Op.iLike]: normalizedEmail } } });
    if (existingUser) {
      return { message: 'If this email is not registered, you will receive an OTP shortly' };
    }
    const otp = this._generateOtp();
    const otpHash = await this._hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await OtpVerification.create({
      identifier: normalizedEmail,
      otpHash,
      purpose: 'registration',
      expiresAt
    });
    try {
      await emailService.sendOtpEmail(normalizedEmail, otp, 'registration');
    } catch (e) {
      logger.error('Send registration OTP email failed', e, { email: logger.sanitize.email(normalizedEmail) });
    }
    return { message: 'If this email is not registered, you will receive an OTP shortly' };
  }

  async verifyRegistrationOtp(email, otp) {
    const normalizedEmail = email && email.trim().toLowerCase();
    if (!normalizedEmail || !otp || String(otp).length !== OTP_LENGTH) {
      throw httpError(400, 'Invalid email or OTP');
    }
    const row = await OtpVerification.findOne({
      where: {
        identifier: normalizedEmail,
        purpose: 'registration',
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });
    if (!row || !(await this._verifyOtp(String(otp).trim(), row.otpHash))) {
      throw httpError(400, 'Invalid or expired OTP');
    }
    await row.update({ usedAt: new Date() });
    return { verified: true, email: normalizedEmail };
  }

  async sendForgotPasswordOtp(email) {
    const normalizedEmail = email && email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw httpError(400, 'Valid email is required');
    }
    const user = await User.findOne({ where: { email: { [Op.iLike]: normalizedEmail } } });
    if (!user) {
      return { message: 'If the email exists, a reset OTP has been sent' };
    }
    const otp = this._generateOtp();
    const otpHash = await this._hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await OtpVerification.create({
      identifier: normalizedEmail,
      otpHash,
      purpose: 'forgot_password',
      expiresAt
    });
    try {
      await emailService.sendOtpEmail(normalizedEmail, otp, 'forgot_password');
    } catch (e) {
      logger.error('Send forgot-password OTP email failed', e, { email: logger.sanitize.email(normalizedEmail) });
    }
    return { message: 'If the email exists, a reset OTP has been sent' };
  }

  async resetPasswordWithOtp(email, otp, newPassword) {
    const normalizedEmail = email && email.trim().toLowerCase();
    if (!normalizedEmail || !otp || !newPassword) {
      throw httpError(400, 'Email, OTP and new password are required');
    }
    if (String(newPassword).length < 8) {
      throw httpError(400, 'Password must be at least 8 characters');
    }
    const row = await OtpVerification.findOne({
      where: {
        identifier: normalizedEmail,
        purpose: 'forgot_password',
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });
    if (!row || !(await this._verifyOtp(String(otp).trim(), row.otpHash))) {
      throw httpError(400, 'Invalid or expired OTP');
    }
    const user = await User.findOne({ where: { email: { [Op.iLike]: normalizedEmail } } });
    if (!user) {
      throw httpError(404, 'User not found');
    }
    await row.update({ usedAt: new Date() });
    const passwordHash = await this.hashPassword(newPassword);
    await user.update({ passwordHash });
    return { message: 'Password reset successfully' };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ where: { email: { [Op.iLike]: (email || '').trim().toLowerCase() } } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (e) {
      logger.error('Send password reset email failed', e, { email: logger.sanitize.email(user.email) });
    }
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetToken, newPassword) {
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      
      if (decoded.type !== 'password_reset') {
        throw httpError(400, 'Invalid token type');
      }

      const user = await User.findByPk(decoded.userId);
      if (!user) {
        throw httpError(404, 'User not found');
      }

      const passwordHash = await this.hashPassword(newPassword);
      await user.update({ passwordHash });

      return { message: 'Password reset successfully' };
    } catch (error) {
      throw httpError(400, 'Invalid or expired reset token');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw httpError(404, 'User not found');
    }

    const isValidPassword = await this.comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw httpError(401, 'Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await user.update({ passwordHash });

    return { message: 'Password changed successfully' };
  }
}

module.exports = new AuthService();