// server/src/server.js
// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, connectDB } = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Prevent 502: keep process alive on unhandled errors so proxy always gets a response
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason, { promise: String(promise) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
});

async function startServer() {
  // Listen immediately so we never return 502 (connection refused). If DB is down, API returns 503.
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server listening', {
      port: PORT,
      environment: process.env.NODE_ENV,
      apiDocs: `http://localhost:${PORT}/api-docs`,
      healthCheck: `http://localhost:${PORT}/api/health`
    });
  });

  try {
    await connectDB();
    logger.info('Database connected - API ready');
  } catch (error) {
    logger.error('Database connection failed - API will return 503 until DB is available', error);
    // Do NOT exit - server keeps running and returns 503 for /api until DB connects
  }

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;