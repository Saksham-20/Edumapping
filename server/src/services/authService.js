// server/src/services/authService.js
const { httpError } = require('../utils/appError');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { User, Organization, OtpVerification, RecruiterProfile } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;
// otp row id -> wrong guesses so far. See _recordFailedOtpAttempt.
const failedOtpAttempts = new Map();

// Same rule the registration and change-password validators enforce. Password
// reset used to accept any eight characters, so an account could be reset to a
// weaker password than it could ever have been created with.
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter and a number';

// Fields a person may set about themselves when signing up. Everything else on
// the User row — approvalStatus, isActive, isVerified, approvedBy, role — is
// decided here, never read from the request. The previous code spread the
// whole body over the defaults, so `"approvalStatus":"approved"` in a signup
// request approved a recruiter on the spot.
const REGISTRATION_FIELDS = ['firstName', 'lastName', 'phone'];
const SELF_REGISTRATION_ROLES = ['student', 'recruiter', 'tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'];
const SCHOOL_STAFF_ROLES = ['principal', 'teacher', 'school_admin', 'career_counselor'];

/**
 * Why a non-admin user may not use the system because of their institution,
 * or null when they may. Shared with middleware/auth.js so sign-in, token
 * refresh and every authenticated request apply the same rule. Expects
 * `user.organization` to be loaded.
 */
function organizationAccessBlock(user) {
  if (!user || user.role === 'admin') return null;
  const org = user.organization;
  if (!org) {
    return user.organizationId
      ? { code: 'Organization Not Found', message: 'Your institution could not be found. Please contact support.' }
      : null;
  }
  if (org.approvalStatus === 'approved') return null;
  if (org.approvalStatus === 'rejected') {
    return {
      code: 'Organization Rejected',
      message: 'Your institution’s registration was not approved. Please contact support for more information.'
    };
  }
  return {
    code: 'Organization Pending Approval',
    message: 'Your institution is pending approval. You can sign in once an EduMapping administrator approves it.'
  };
}

class AuthService {
  // crypto.randomInt, not Math.random: Math.random is not a CSPRNG and its
  // state can be recovered from a handful of outputs, which would make every
  // later code predictable. randomInt is uniform over the whole range, so
  // leading zeros are as likely as any other digit.
  _generateOtp() {
    return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  }

  /**
   * Count a wrong guess against one stored OTP and burn the OTP once it has
   * absorbed MAX_OTP_ATTEMPTS. A six-digit code is a million possibilities; with
   * no counter the only brake was the IP rate limiter, which a rotating pool of
   * addresses walks straight through within the code's lifetime. Burning the
   * row means a guesser has to trigger a fresh code (rate limited separately,
   * and announced to the real owner by email) after every five tries.
   *
   * The tally lives in process memory because otp_verifications has no column
   * for it and this change must not add a migration. That is sound for the
   * single PM2 process this runs as; a restart forgives at most four guesses
   * per code. If the API is ever clustered this belongs in the table.
   */
  async _recordFailedOtpAttempt(row) {
    const key = row.id;
    const count = (failedOtpAttempts.get(key) || 0) + 1;
    if (count >= MAX_OTP_ATTEMPTS) {
      failedOtpAttempts.delete(key);
      await row.update({ usedAt: new Date() });
      logger.warn('OTP invalidated after too many failed attempts', {
        purpose: row.purpose,
        identifier: logger.sanitize.email(row.identifier)
      });
      return;
    }
    failedOtpAttempts.set(key, count);
    // Rows expire on their own; forget the tally soon after, so the map
    // cannot grow without bound.
    setTimeout(() => failedOtpAttempts.delete(key), OTP_EXPIRY_MINUTES * 60 * 1000 + 60 * 1000).unref();
  }

  /**
   * Check `otp` against the newest live row for this address and purpose,
   * counting failures. Returns the row on success; throws 400 otherwise.
   */
  async _consumeOtp(identifier, purpose, otp) {
    const row = await OtpVerification.findOne({
      where: {
        identifier,
        purpose,
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });
    if (!row) {
      throw httpError(400, 'Invalid or expired OTP');
    }
    if (!(await this._verifyOtp(String(otp).trim(), row.otpHash))) {
      await this._recordFailedOtpAttempt(row);
      throw httpError(400, 'Invalid or expired OTP');
    }
    failedOtpAttempts.delete(row.id);
    return row;
  }

  /**
   * Whether registration must present an emailed OTP. Only when mail can
   * actually be delivered: demanding a code nobody can receive is what welded
   * signup shut before 458ce55. With SMTP configured the code is mandatory, so
   * an address has to be owned before an account can be created on it.
   */
  emailVerificationRequired() {
    return emailService.isConfigured();
  }

  async _hashOtp(otp) {
    const saltRounds = 10;
    return await bcrypt.hash(otp, saltRounds);
  }

  async _verifyOtp(otp, otpHash) {
    return await bcrypt.compare(otp, otpHash);
  }

  /**
   * A standing code that is accepted in place of an emailed OTP.
   *
   * This exists because email delivery is not configured in production: the OTP
   * was generated, stored, and never sent, so `send-otp` reported success and
   * registration could not be completed by anybody. A bypass code is the bridge
   * until SMTP credentials are in place.
   *
   * Understand exactly what it gives up. With this set, anyone can register an
   * address they do not own — including one at an institution's domain — so the
   * only remaining barrier for a TPO or recruiter signup is the human approval
   * queue. That is a deliberate, temporary trade, which is why:
   *
   *   * it is off unless OTP_BYPASS_CODE is explicitly set,
   *   * it is refused for password reset, where it would be account takeover of
   *     any existing account including an admin's,
   *   * a real emailed OTP still works, so turning SMTP on needs no code change,
   *   * every acceptance is logged at WARN with the address, so the accounts
   *     created this way can be found and re-verified afterwards.
   *
   * Remove OTP_BYPASS_CODE the moment SMTP works.
   */
  _isBypassOtp(otp) {
    const configured = process.env.OTP_BYPASS_CODE;
    if (!configured) return false;

    const a = Buffer.from(String(otp).trim());
    const b = Buffer.from(String(configured).trim());
    // timingSafeEqual throws on a length mismatch, which is itself the answer.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * On a developer machine with no SMTP the code would vanish, so the only
   * way to exercise the OTP path locally would be to read the bcrypt hash.
   * Strictly development and strictly unconfigured mail: a code in a
   * production log is a code anyone with log access can use.
   */
  _logDevOtp(email, otp, purpose) {
    if (process.env.NODE_ENV === 'development' && !emailService.isConfigured()) {
      logger.info('DEV ONLY: OTP not emailed (SMTP not configured)', { email, purpose, otp });
    }
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
      const { email, otp, password, role } = userData;
      const organizationId = userData.organizationId ? parseInt(userData.organizationId, 10) : null;
      const normalizedEmail = email && email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw httpError(400, 'Email is required');
      }
      // The route validator already restricts this; repeated here because the
      // service is the thing that writes the row, and an admin account must
      // never be self-service whichever caller reaches it.
      if (!SELF_REGISTRATION_ROLES.includes(role)) {
        throw httpError(400, 'This role cannot be registered');
      }

      // With mail delivery configured the code is mandatory: it is the only
      // proof that the person signing up owns the address. Without it (dev, or
      // production before SMTP is set up) signup proceeds as 458ce55 intended,
      // and the approval queue below is what stands between a stranger and an
      // institution's data. A code that is supplied is always checked.
      let emailVerified = false;
      if (otp) {
        await this.verifyRegistrationOtp(normalizedEmail, otp);
        emailVerified = true;
      } else if (this.emailVerificationRequired()) {
        throw httpError(400, 'Enter the verification code sent to your email');
      }
      logger.debug('Registration attempt', { email: logger.sanitize.email(normalizedEmail), role, organizationId: organizationId || 'none' });

      // Check if user exists
      const existingUser = await User.findOne({ where: { email: { [Op.iLike]: normalizedEmail } } });
      if (existingUser) {
        throw httpError(409, 'User already exists with this email');
      }

      if (!organizationId) {
        throw httpError(400, 'Organization is required for this role');
      }
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
      if (role === 'recruiter' && organization.type !== 'company') {
        throw httpError(400, 'Recruiters can only belong to company organizations');
      }
      if (SCHOOL_STAFF_ROLES.includes(role) && organization.type !== 'school') {
        throw httpError(400, 'School roles can only belong to school organizations');
      }

      // An institution nobody has approved yet can only be joined by the staff
      // member registering it alongside (they wait in the queue with it). A
      // student joining a pending or rejected institution would be an approved
      // account inside an organization the platform has not vetted.
      if (organization.approvalStatus !== 'approved') {
        if (organization.approvalStatus === 'rejected' || role === 'student') {
          throw httpError(400, 'This institution is not open for registration yet');
        }
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      const profile = {};
      for (const field of REGISTRATION_FIELDS) {
        if (userData[field] !== undefined) profile[field] = userData[field];
      }
      if (profile.phone === '') profile.phone = null;

      // Only a student is approved on sight. Everyone else speaks for an
      // institution or gets access to other people's records — a TPO and every
      // school staff role administer a roster that includes minors, a
      // recruiter gets scoped access to student data — so all of them wait
      // for review. School staff used to be approved on sight, which meant
      // anyone could sign up as a "teacher" at any school and read its pupils.
      const autoApprove = role === 'student';
      const approvalStatus = autoApprove ? 'approved' : 'pending';
      const isActive = autoApprove;

      // Create user
      let user;
      try {
        user = await User.create({
          ...profile,
          email: normalizedEmail,
          passwordHash,
          role,
          organizationId,
          approvalStatus,
          isActive,
          isVerified: emailVerified
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

      // A recruiter without a profile row had nowhere for an admin to record
      // allowed institutions: the permissions screens answered 404 until the
      // recruiter happened to save their own profile. Created empty, which is
      // also "no access" until an admin grants some.
      if (role === 'recruiter') {
        await RecruiterProfile.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id } });
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
      // iLike for case, with its wildcards escaped: "_" in an address would
      // otherwise match any character and could pick up someone else's row.
      const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
      const user = await User.findOne({
        where: { email: { [Op.iLike]: escaped } },
        include: [{ model: Organization, as: 'organization' }]
      });
      if (user) return user;

      // Registration once ran the address through normalizeEmail(), which
      // drops the dots from Gmail addresses. Those accounts are stored as
      // "sanjaydixit@gmail.com" while their owners type "sanjay.dixit@…", so a
      // Gmail address with dots also tries its dotless form.
      const [local, host] = trimmed.toLowerCase().split('@');
      if ((host === 'gmail.com' || host === 'googlemail.com') && local.includes('.')) {
        return await User.findOne({
          where: { email: { [Op.iLike]: `${local.replace(/\./g, '')}@${host}`.replace(/[\\%_]/g, (c) => `\\${c}`) } },
          include: [{ model: Organization, as: 'organization' }]
        });
      }
      return null;
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

    // An approved person inside an unapproved institution is still inside an
    // institution nobody has vetted. Checked after the password so the answer
    // does not tell a stranger which addresses belong to a pending college.
    const orgBlock = organizationAccessBlock(user);
    if (orgBlock) {
      throw httpError(403, orgBlock.message);
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
    
    const user = await User.findByPk(decoded.userId, {
      include: [{ model: Organization, as: 'organization' }]
    });
    if (!user || !user.isActive || organizationAccessBlock(user)) {
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
      this._logDevOtp(normalizedEmail, otp, 'registration');
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

    // Checked before the lookup on purpose: when email is not being delivered,
    // insisting on a stored row would still require a send-otp round trip whose
    // whole point was to mail something. Any row that does exist is consumed
    // below so the same code cannot also replay a real pending OTP.
    if (this._isBypassOtp(otp)) {
      logger.warn('Registration OTP bypass code accepted', {
        email: logger.sanitize.email(normalizedEmail)
      });
      const pending = await OtpVerification.findOne({
        where: {
          identifier: normalizedEmail,
          purpose: 'registration',
          usedAt: null,
          expiresAt: { [Op.gt]: new Date() }
        },
        order: [['createdAt', 'DESC']]
      });
      if (pending) await pending.update({ usedAt: new Date() });
      return { verified: true, email: normalizedEmail, viaBypass: true };
    }

    const row = await this._consumeOtp(normalizedEmail, 'registration', otp);
    await row.update({ usedAt: new Date() });
    return { verified: true, email: normalizedEmail };
  }

  async sendForgotPasswordOtp(email) {
    const normalizedEmail = email && email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw httpError(400, 'Valid email is required');
    }
    // Same lookup as sign-in, so a Gmail address saved without its dots is found.
    const user = await this._findUserByIdentifier(normalizedEmail);
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
      this._logDevOtp(normalizedEmail, otp, 'forgot_password');
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
    if (String(newPassword).length < 8 || !PASSWORD_POLICY.test(String(newPassword))) {
      throw httpError(400, PASSWORD_POLICY_MESSAGE);
    }

    // The registration bypass must never reach this path. Accepting a standing
    // code here would let anyone reset the password of any account whose email
    // they can guess, the admin's included. Refused loudly rather than silently
    // falling through to the hash comparison, so an attempt is visible.
    if (this._isBypassOtp(otp)) {
      logger.warn('Bypass code rejected for password reset', {
        email: logger.sanitize.email(normalizedEmail)
      });
      throw httpError(400, 'Invalid or expired OTP');
    }

    const row = await this._consumeOtp(normalizedEmail, 'forgot_password', otp);
    // Same lookup as sign-in, so a Gmail address saved without its dots is found.
    const user = await this._findUserByIdentifier(normalizedEmail);
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
      if (!newPassword || String(newPassword).length < 8 || !PASSWORD_POLICY.test(String(newPassword))) {
        throw httpError(400, PASSWORD_POLICY_MESSAGE);
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
module.exports.PASSWORD_POLICY = PASSWORD_POLICY;
module.exports.organizationAccessBlock = organizationAccessBlock;
module.exports.PASSWORD_POLICY_MESSAGE = PASSWORD_POLICY_MESSAGE;