// server/src/middleware/requestId.js
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Middleware to generate and attach request ID to each request
 * This helps with request correlation in logs
 */
const requestIdMiddleware = (req, res, next) => {
  // Use existing request ID from header or generate new one
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Attach to request object
  req.requestId = requestId;
  
  // Set logger's request ID for this request
  logger.setRequestId(requestId);
  
  // Add request ID to response header
  res.setHeader('X-Request-ID', requestId);
  
  // Clear request ID after response finishes
  res.on('finish', () => {
    logger.clearRequestId();
  });
  
  next();
};

module.exports = requestIdMiddleware;

