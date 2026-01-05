// server/src/config/database.js
// Always load .env file (for migrations and CLI tools)
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Try to find .env file in multiple locations
const envPaths = [
  path.join(__dirname, '../../.env'),  // server/.env
  path.join(__dirname, '../../../.env'), // root/.env
  path.join(process.cwd(), '.env'),      // current working directory
  '/var/www/campusconnect/server/.env'  // absolute path
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    logger.debug('Loaded .env file', { path: envPath });
    break;
  }
}

if (!envLoaded) {
  logger.warn('No .env file found in expected locations, using environment variables only');
  require('dotenv').config(); // Try default location anyway
}

// Helper function to parse DATABASE_URL for production
function parseDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL manually
    const url = process.env.DATABASE_URL;
    logger.debug('Parsing DATABASE_URL for production config');
    
    // Handle both formats: with port and without port, and both postgres:// and postgresql://
    const schemeRegex = /postgres(?:ql)?:\/\//;
    // Normalize scheme to ease regex matching
    const normalized = url.replace(schemeRegex, 'postgres://');
    let urlParts = normalized.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    let username, password, host, port, database;

    if (urlParts) {
      // Format with port: postgresql://user:pass@host:port/db
      [, username, password, host, port, database] = urlParts;
    } else {
      // Format without port: postgresql://user:pass@host/db (default port 5432)
      urlParts = normalized.match(/postgres:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
      if (urlParts) {
        [, username, password, host, database] = urlParts;
        port = '5432'; // Default PostgreSQL port
      }
    }

    if (urlParts) {
      logger.debug('Parsed DATABASE_URL', { 
        username: logger.sanitize.email(username), 
        host, 
        port, 
        database 
      });
      const sslRequired = process.env.PGSSLMODE === 'require' || process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
      return {
        username,
        password,
        host,
        port: parseInt(port),
        database,
        dialect: 'postgres',
        dialectOptions: sslRequired
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
        logging: false,
        pool: {
          max: 20,
          min: 5,
          acquire: 60000,
          idle: 10000
        }
      };
    } else {
      logger.error('Failed to parse DATABASE_URL', new Error('Invalid DATABASE_URL format'));
      throw new Error('Invalid DATABASE_URL format');
    }
  } else {
    logger.error('DATABASE_URL not found in production', new Error('DATABASE_URL is required'));
    throw new Error('DATABASE_URL is required in production');
  }
}

// Production config - prefers individual env vars, falls back to DATABASE_URL
let productionConfig;

// Check if we have individual DB variables (more reliable)
if (process.env.DB_PASSWORD && process.env.DB_USERNAME) {
  productionConfig = {
    username: String(process.env.DB_USERNAME) || 'postgres',
    password: String(process.env.DB_PASSWORD) || 'postgres',
    database: String(process.env.DB_NAME || 'edumapping_prod'),
    host: String(process.env.DB_HOST || 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    dialectOptions: (process.env.PGSSLMODE === 'require' || process.env.DATABASE_SSL === 'true')
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    }
  };
  logger.debug('Using individual DB environment variables');
} else if (process.env.DATABASE_URL) {
  // Fall back to DATABASE_URL if individual vars not available
  productionConfig = parseDatabaseUrl();
} else {
  throw new Error('Either DB_PASSWORD/DB_USERNAME or DATABASE_URL must be set');
}

// Validate production config has required fields
if (!productionConfig.password || productionConfig.password === '') {
  logger.error('Database password is missing or empty', new Error('Database password is required'));
  throw new Error('Database password is required');
}

logger.debug('Production DB config loaded', { 
  username: logger.sanitize.email(productionConfig.username), 
  host: productionConfig.host, 
  port: productionConfig.port, 
  database: productionConfig.database,
  hasPassword: !!productionConfig.password 
});

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'edumapping_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (query) => logger.database('QUERY', 'database', null, { query }) : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: (process.env.DB_NAME || 'edumapping') + '_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  },
  production: productionConfig
};