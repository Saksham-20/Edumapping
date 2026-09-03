// server/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

/**
 * Rate limiting is a production concern. Locally it only gets in the way: the
 * auth limiter allows 5 attempts per 15 minutes, which a developer or an
 * automated test run exhausts almost immediately and then cannot recover from
 * without waiting out the window. The limiters defined in `app.js` already skip
 * localhost in development; the ones here did not, so a mistyped password
 * during development locked out login for a quarter of an hour.
 *
 * Only loopback addresses are skipped, and only when NODE_ENV is development,
 * so production remains fully rate limited.
 */
const skipLocalhostInDev = (req) => {
  if (process.env.NODE_ENV !== 'development') return false;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost');
};

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: skipLocalhostInDev
});

// Password reset limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    error: 'Too Many Password Reset Attempts',
    message: 'Too many password reset attempts, please try again later'
  },
  skip: skipLocalhostInDev
});

// OTP send limiter (registration + forgot-password) - prevent enumeration and abuse
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 5,
  message: {
    error: 'Too Many OTP Requests',
    message: 'Too many OTP requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalhostInDev
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 file uploads per hour
  message: {
    error: 'Upload Limit Exceeded',
    message: 'Too many file uploads, please try again later'
  },
  skip: skipLocalhostInDev
});

// Application submission limiter
const applicationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 applications per day
  message: {
    error: 'Application Limit Exceeded',
    message: 'Too many applications submitted today, please try again tomorrow'
  },
  skip: skipLocalhostInDev
});

// Search API limiter
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    error: 'Search Limit Exceeded',
    message: 'Too many search requests, please slow down'
  },
  skip: skipLocalhostInDev
});

// Create dynamic limiter based on user role
const createRoleLimiter = (limits) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'guest';
    const limit = limits[userRole] || limits.default || 100;
    
    const dynamicLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: limit,
      keyGenerator: (req) => {
        return req.user?.id ? `user_${req.user.id}` : req.ip;
      },
      message: {
        error: 'Rate Limit Exceeded',
        message: `Rate limit exceeded for ${userRole} role`
      }
    });

    dynamicLimiter(req, res, next);
  };
};

// IP-based limiter with whitelist
const createIPLimiter = (options = {}) => {
  const whitelist = options.whitelist || [];
  
  return rateLimit({
    ...options,
    skip: (req) => {
      // Skip rate limiting for whitelisted IPs
      return whitelist.includes(req.ip);
    },
    keyGenerator: (req) => {
      // Use user ID if available, otherwise IP
      return req.user?.id ? `user_${req.user.id}` : req.ip;
    }
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  otpSendLimiter,
  uploadLimiter,
  applicationLimiter,
  searchLimiter,
  createRoleLimiter,
  createIPLimiter
};