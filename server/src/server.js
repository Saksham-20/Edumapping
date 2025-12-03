// server/src/server.js
// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, connectDB } = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        apiDocs: `http://localhost:${PORT}/api-docs`,
        healthCheck: `http://localhost:${PORT}/api/health`
      });
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;