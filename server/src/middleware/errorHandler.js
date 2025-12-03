// server/src/middleware/errorHandler.js
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    statusCode: err.status || 500
  });

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message
    }));
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    // Extract more details about which constraint failed
    const constraintName = err.parent?.constraint || err.fields?.join(', ') || 'unknown';
    const field = err.errors?.[0]?.path || constraintName;
    
    // Handle primary key constraint errors (sequence issues)
    if (constraintName === 'organizations_pkey' || constraintName === 'users_pkey' || constraintName.includes('_pkey')) {
      logger.error('Primary key constraint error detected - sequence may be out of sync', null, {
        constraint: constraintName,
        detail: err.parent?.detail,
        code: err.parent?.code,
        message: 'This usually indicates the auto-increment sequence needs to be reset'
      });
      return res.status(500).json({
        error: 'Database Error',
        message: 'A database error occurred. Please try again or contact support if the problem persists.'
      });
    }
    
    logger.warn('Unique constraint error', {
      constraint: constraintName,
      fields: err.fields,
      message: err.parent?.message
    });
    
    // Format details as array to match client expectations
    const details = err.errors?.map(error => ({
      field: error.path || field,
      message: error.message || `A record with this ${field} already exists`
    })) || [{
      field: field,
      message: `A record with this ${field} already exists`
    }];
    
    // Provide user-friendly messages based on the field
    let userMessage = `A record with this ${field} already exists`;
    if (field === 'domain') {
      userMessage = `An organization with this domain is already registered. Please use a different domain.`;
    } else if (field === 'name') {
      userMessage = `An organization with this name is already registered. Please use a different name.`;
    }
    
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: userMessage,
      details: details
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'The provided token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'The provided token has expired'
    });
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File Too Large',
      message: 'The uploaded file exceeds the size limit'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
