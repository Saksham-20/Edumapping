// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User, Organization } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Server configuration error: authentication not configured'
      });
    }
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user with organization details
    const user = await User.findByPk(decoded.userId, {
      include: [
        {
          model: Organization,
          as: 'organization'
        }
      ],
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      if (user.approvalStatus === 'pending') {
        return res.status(401).json({
          error: 'Account Pending Approval',
          message: 'Your account is pending approval. Please wait for TPO/Admin approval before accessing the system.'
        });
      } else if (user.approvalStatus === 'rejected') {
        return res.status(401).json({
          error: 'Account Rejected',
          message: 'Your account has been rejected. Please contact support for more information.'
        });
      } else {
        return res.status(401).json({
          error: 'Account Disabled',
          message: 'Your account has been disabled. Please contact support for more information.'
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Please login again'
      });
    }
    
    return res.status(403).json({
      error: 'Invalid Token',
      message: 'Token verification failed'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId, {
        include: [{ model: Organization, as: 'organization' }],
        attributes: { exclude: ['passwordHash'] }
      });
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't return error, just continue without user
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
