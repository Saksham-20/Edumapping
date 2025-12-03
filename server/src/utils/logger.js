// server/src/utils/logger.js
const crypto = require('crypto');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level based on environment
const getLogLevel = () => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const currentLogLevel = getLogLevel();

// Sanitization functions
const sanitize = {
  // Mask email: show first 2 chars and domain
  email: (email) => {
    if (!email || typeof email !== 'string') return '[REDACTED]';
    const [localPart, domain] = email.split('@');
    if (!domain) return '[REDACTED]';
    if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
    return `${localPart.substring(0, 2)}***@${domain}`;
  },

  // Remove passwords and tokens
  password: () => '[REDACTED]',
  token: () => '[REDACTED]',
  
  // Sanitize database connection strings
  dbConnection: (config) => {
    if (!config) return '[REDACTED]';
    return {
      ...config,
      password: '[REDACTED]',
      username: config.username ? sanitize.email(config.username) : '[REDACTED]'
    };
  },

  // Remove PII from objects
  object: (obj, sensitiveFields = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'email']) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize.object(item, sensitiveFields));
    }
    const sanitized = { ...obj };
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (field === 'email') {
          sanitized[field] = sanitize.email(sanitized[field]);
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }
    return sanitized;
  },

  // Sanitize error messages
  error: (error) => {
    if (!error) return '[Unknown Error]';
    if (typeof error === 'string') {
      // Remove potential PII from error messages
      return error.replace(/email[:\s]+[\w@.]+/gi, 'email: [REDACTED]')
                  .replace(/password[:\s]+[\w]+/gi, 'password: [REDACTED]')
                  .replace(/token[:\s]+[\w.]+/gi, 'token: [REDACTED]');
    }
    return {
      name: error.name,
      message: sanitize.error(error.message),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    };
  }
};

// Format log entry
const formatLog = (level, message, context = {}, requestId = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(requestId && { requestId }),
    ...(Object.keys(context).length > 0 && { context: sanitize.object(context) })
  };

  // In production, return JSON; in development, return readable format
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(logEntry);
  } else {
    // Development format: readable with colors
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[90m', // Gray
      RESET: '\x1b[0m'
    };
    const color = colors[level] || colors.RESET;
    const reset = colors.RESET;
    const reqIdStr = requestId ? ` [${requestId}]` : '';
    return `${color}[${level}]${reset} ${timestamp}${reqIdStr} ${message}${Object.keys(context).length > 0 ? ' ' + JSON.stringify(sanitize.object(context), null, 2) : ''}`;
  }
};

// Logger class
class Logger {
  constructor() {
    this.requestId = null;
  }

  setRequestId(requestId) {
    this.requestId = requestId;
  }

  clearRequestId() {
    this.requestId = null;
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= currentLogLevel;
  }

  log(level, message, context = {}) {
    if (!this.shouldLog(level)) return;

    const formatted = formatLog(level, message, context, this.requestId);
    
    // Use appropriate console method
    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  error(message, error = null, context = {}) {
    const errorContext = {
      ...context,
      ...(error && { error: sanitize.error(error) })
    };
    this.log('ERROR', message, errorContext);
  }

  warn(message, context = {}) {
    this.log('WARN', message, context);
  }

  info(message, context = {}) {
    this.log('INFO', message, context);
  }

  debug(message, context = {}) {
    this.log('DEBUG', message, context);
  }

  // Specialized logging methods
  request(method, path, statusCode, duration, context = {}) {
    const requestContext = {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      ...context
    };
    if (statusCode >= 500) {
      this.error(`Request failed: ${method} ${path}`, null, requestContext);
    } else if (statusCode >= 400) {
      this.warn(`Request error: ${method} ${path}`, requestContext);
    } else {
      this.info(`Request: ${method} ${path}`, requestContext);
    }
  }

  database(operation, table, duration = null, context = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.debug(`DB ${operation}: ${table}`, {
        ...context,
        ...(duration && { duration: `${duration}ms` })
      });
    }
  }

  auth(operation, userId = null, success = true, context = {}) {
    const authContext = {
      operation,
      ...(userId && { userId }),
      success,
      ...context
    };
    if (success) {
      this.info(`Auth ${operation}`, authContext);
    } else {
      this.warn(`Auth ${operation} failed`, authContext);
    }
  }

  file(operation, filePath, context = {}) {
    // Sanitize file path to remove sensitive info
    const sanitizedPath = filePath ? filePath.replace(/\/[^\/]+\.(pdf|doc|docx)$/, '/[FILENAME]') : '[UNKNOWN]';
    this.info(`File ${operation}`, {
      path: sanitizedPath,
      ...context
    });
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger and sanitize utilities
module.exports = logger;
module.exports.sanitize = sanitize;

