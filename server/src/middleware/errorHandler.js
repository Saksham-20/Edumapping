// server/src/middleware/errorHandler.js
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Avoid "Cannot set headers after they are sent" - can crash process and cause 502
  if (res.headersSent) {
    return next();
  }
  if (!err) {
    return next();
  }

  // Log full error details for debugging
  console.error('=== ERROR HANDLER ===');
  console.error('Error Name:', err.name);
  console.error('Error Message:', err.message);
  console.error('Error Stack:', err.stack);
  if (err.parent) {
    console.error('Parent Error:', err.parent.message);
    console.error('Parent Code:', err.parent.code);
    console.error('Parent Detail:', err.parent.detail);
  }
  console.error('Request Path:', req.path);
  console.error('Request Method:', req.method);
  console.error('===================');
  
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

  // Sequelize database errors (e.g., invalid ENUM values)
  if (err.name === 'SequelizeDatabaseError') {
    const errorMessage = err.parent?.message || err.message || '';
    const errorCode = err.parent?.code || '';
    const errorDetail = err.parent?.detail || '';
    
    // Log full error details for debugging
    logger.error('Database error details', {
      name: err.name,
      message: errorMessage,
      code: errorCode,
      detail: errorDetail,
      sql: err.parent?.sql,
      stack: err.stack
    });
    
    // Check if it's an invalid ENUM value error
    if (errorMessage.includes('invalid input value for enum') || 
        errorMessage.includes('enum_users_role') ||
        errorMessage.includes('invalid value for enum')) {
      logger.error('Invalid ENUM value error - migration may not have been run', err, {
        message: errorMessage,
        hint: 'The database migration for new user roles may not have been executed'
      });
      return res.status(500).json({
        error: 'Database Configuration Error',
        message: 'The selected role is not available. This may indicate that database migrations need to be run. Please contact support.'
      });
    }
    
    // Check for foreign key constraint errors
    if (errorCode === '23503' || errorMessage.includes('foreign key constraint')) {
      logger.error('Foreign key constraint error', err, {
        message: errorMessage,
        detail: errorDetail
      });
      return res.status(400).json({
        error: 'Invalid Reference',
        message: errorDetail || 'The provided organization or reference does not exist. Please check your selection and try again.'
      });
    }
    
    // Check for not null constraint errors
    if (errorCode === '23502' || errorMessage.includes('null value in column')) {
      logger.error('Not null constraint error', err, {
        message: errorMessage,
        detail: errorDetail
      });
      return res.status(400).json({
        error: 'Missing Required Field',
        message: errorDetail || 'A required field is missing. Please check your input and try again.'
      });
    }
    
    // Generic database error - include more details in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      error: 'Database Error',
      message: isDevelopment && errorMessage 
        ? `Database error: ${errorMessage}` 
        : 'A database error occurred. Please try again or contact support if the problem persists.',
      ...(isDevelopment && { 
        detail: errorDetail, 
        code: errorCode,
        sql: err.parent?.sql,
        fullError: errorMessage
      })
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
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      return res.status(500).json({
        error: 'Database Error',
        message: 'A database error occurred. The auto-increment sequence may be out of sync. Please contact support.',
        ...(isDevelopment && {
          hint: `Run 'node fix-user-sequence.js' in the server directory to fix the sequence`,
          detail: err.parent?.detail,
          code: err.parent?.code
        })
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
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
    ...(isDevelopment && { 
      stack: err.stack,
      ...(err.parent && {
        parentMessage: err.parent.message,
        parentCode: err.parent.code,
        parentDetail: err.parent.detail,
        parentSql: err.parent.sql
      })
    })
  });
};

module.exports = errorHandler;
