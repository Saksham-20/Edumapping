// server/src/app.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const jwt = require('jsonwebtoken');

// Use models for both development and production
const models = require('./models');
const sequelize = models.sequelize;
const errorHandler = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestId');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const resumeRoutes = require('./routes/resume');
const eventRoutes = require('./routes/events');
const assessmentRoutes = require('./routes/assessments');
const notificationRoutes = require('./routes/notifications');
const fileRoutes = require('./routes/files');
const organizationsRoutes = require('./routes/organizations');
const achievementRoutes = require('./routes/achievements');
const statisticsRoutes = require('./routes/statistics');
const approvalRoutes = require('./routes/approvals');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');


const app = express();

// Trust proxy for rate limiting (required for Render)
app.set('trust proxy', 1);

// Request ID middleware (must be early in the middleware chain)
app.use(requestIdMiddleware);

// Security middleware (more strict in production)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  } : false,
  hsts: process.env.NODE_ENV === 'production' ? undefined : false
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const defaultDevOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    // Support multiple frontend URLs (comma-separated) and individual URLs
    const frontendUrls = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean)
      : [];

    const allowed = new Set([
      ...frontendUrls,
      ...(process.env.NODE_ENV === 'development' ? defaultDevOrigins : [])
    ].filter(Boolean));

    if (!origin) return callback(null, true); // allow non-browser clients
    if (allowed.has(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed from this origin'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting with user-based keys for authenticated requests
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 500 : 1000), // Much higher limit in development
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for authenticated requests, IP for unauthenticated
  keyGenerator: (req) => {
    // Try to extract user ID from JWT token
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        if (token) {
          const decoded = jwt.decode(token); // Decode without verification (for rate limiting only)
          if (decoded && decoded.userId) {
            return `user_${decoded.userId}`;
          }
        }
      }
    } catch (error) {
      // If token extraction fails, fall back to IP
    }
    // If user is authenticated (from middleware), use their ID
    if (req.user && req.user.id) {
      return `user_${req.user.id}`;
    }
    // For unauthenticated requests, use IP
    return req.ip || req.connection.remoteAddress;
  },
  // Skip rate limiting for health check and localhost in development
  skip: (req) => {
    if (req.path === '/api/health') {
      return true;
    }
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.connection.remoteAddress || '';
      if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost')) {
        return true;
      }
    }
    return false;
  }
});

// More lenient limiter for frequent auth endpoints
// Extracts user ID from JWT token without full authentication
const authCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // Increased limit for auth checks
  message: {
    error: 'Too many authentication check requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Try to extract user ID from JWT token
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        if (token) {
          const decoded = jwt.decode(token); // Decode without verification (for rate limiting only)
          if (decoded && decoded.userId) {
            return `user_auth_${decoded.userId}`;
          }
        }
      }
    } catch (error) {
      // If token extraction fails, fall back to IP
    }
    // For unauthenticated requests or if token extraction fails, use IP
    return req.ip || req.connection.remoteAddress;
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.connection.remoteAddress || '';
      if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost')) {
        return true;
      }
    }
    return false;
  }
});

// Apply auth check limiter to /auth/me endpoint
app.use('/api/auth/me', authCheckLimiter);
// Apply general limiter to all other API routes
app.use('/api/', limiter);

// Request logging middleware (after rate limiting)
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(req.method, req.path, res.statusCode, duration, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EduMapping API',
      version: '1.0.0',
      description: 'A comprehensive campus recruitment platform API',
      contact: {
        name: 'EduMapping Team',
        email: 'support@edumapping.com'
      }
    },
    servers: [
      {
        url: process.env.API_PUBLIC_URL
          || (process.env.NODE_ENV === 'production'
            ? `http://localhost:${process.env.PORT || 5000}`
            : `http://localhost:${process.env.PORT || 5000}`),
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'EduMapping API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Debug endpoints - only available in development
if (process.env.NODE_ENV === 'development') {
  // Debug endpoint to check database and user
  app.get('/api/debug/user/:email', async (req, res) => {
  try {
    const { User, Organization } = models;
    const { email } = req.params;

    logger.debug('Debug: Looking for user', { email: logger.sanitize.email(email) });

    // Test database connection first
    await sequelize.authenticate();
    logger.debug('Debug: Database connection successful');

    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Organization,
          as: 'organization'
        }
      ]
    });

    logger.debug('Debug: User lookup complete', { found: !!user, userId: user?.id });

    res.json({
      found: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
        organization: user.organization
      } : null
    });
  } catch (error) {
    logger.error('Debug endpoint error', error, { endpoint: '/api/debug/user/:email' });
    res.status(500).json({ error: error.message });
  }
});

  // Manual seeding endpoint
  app.post('/api/debug/seed', async (req, res) => {
  try {
    logger.info('Starting manual database seeding');

    // Run the seeders
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync('NODE_ENV=production npx sequelize-cli db:seed:all');

    logger.info('Database seeding completed', { hasOutput: !!stdout, hasErrors: !!stderr });

    res.json({
      success: true,
      message: 'Database seeded successfully',
      output: stdout
    });
  } catch (error) {
    logger.error('Database seeding error', error);
    res.status(500).json({
      success: false,
      error: error.message,
      output: error.stdout || '',
      errors: error.stderr || ''
    });
  }
});

  // List all users endpoint
  app.get('/api/debug/users', async (req, res) => {
  try {
    const { User, Organization } = models;

    logger.debug('Debug: Fetching all users');

    // Test database connection first
    await sequelize.authenticate();
    logger.debug('Debug: Database connection successful');

    const users = await User.findAll({
      include: [
        {
          model: Organization,
          as: 'organization'
        }
      ],
      limit: 10
    });

    logger.debug('Debug: User fetch complete', { count: users.length });

    res.json({
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
        organization: user.organization ? {
          id: user.organization.id,
          name: user.organization.name
        } : null
      }))
    });
  } catch (error) {
    logger.error('Debug endpoint error', error, { endpoint: '/api/debug/users' });
    res.status(500).json({ error: error.message });
  }
});

  // Test login endpoint with detailed debugging
  app.post('/api/debug/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    logger.debug('Debug: Testing login', { email: logger.sanitize.email(email) });

    const { User, Organization } = models;
    const bcrypt = require('bcryptjs');

    // Test database connection first
    await sequelize.authenticate();
    logger.debug('Debug: Database connection successful');

    // Step 1: Check if user exists
    logger.debug('Step 1: Looking for user');
    const user = await User.findOne({
      where: { email, isActive: true },
      include: [
        {
          model: Organization,
          as: 'organization'
        }
      ]
    });

    logger.debug('User lookup complete', { 
      found: !!user, 
      userId: user?.id,
      role: user?.role,
      isActive: user?.isActive,
      approvalStatus: user?.approvalStatus
    });

    if (!user) {
      return res.json({
        success: false,
        step: 'user_lookup',
        message: 'User not found or inactive',
        user: null
      });
    }

    // Step 2: Check password
    logger.debug('Step 2: Checking password');
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    logger.debug('Password check complete', { valid: isPasswordValid });

    if (!isPasswordValid) {
      return res.json({
        success: false,
        step: 'password_check',
        message: 'Invalid password',
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    }

    // Step 3: Check approval status
    logger.debug('Step 3: Checking approval status');
    if (user.approvalStatus !== 'approved') {
      return res.json({
        success: false,
        step: 'approval_check',
        message: 'User not approved',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          approvalStatus: user.approvalStatus
        }
      });
    }

    // Step 4: Generate tokens (simplified)
    logger.debug('Step 4: Generating tokens');
    const jwt = require('jsonwebtoken');
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );

    logger.debug('Token generation complete', { hasToken: !!accessToken });

    res.json({
      success: true,
      message: 'Login test successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
        organization: user.organization
      },
      hasToken: !!accessToken
    });

  } catch (error) {
    logger.error('Debug login error', error, { endpoint: '/api/debug/test-login' });
    res.status(500).json({
      success: false,
      step: 'error',
      error: error.message,
      stack: error.stack
    });
  }
});
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// Serve static files from React app in production (only if enabled)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_CLIENT !== 'false') {
  const clientBuildPath = path.join(__dirname, '../../client/build');
  app.use(express.static(clientBuildPath));

  // Handle React routing - return all non-API requests to React app
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    }
  });
} else {
  // 404 handler for backend-only service (separate frontend deployment)
  app.use('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({
        error: 'Not Found',
        message: `API route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: 'Not Found',
        message: 'This is the API server. Please use the frontend application.',
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Global error handler
app.use(errorHandler);

// Database connection with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`Attempting database connection (attempt ${i + 1}/${retries})`, {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL
      });

      await sequelize.authenticate();
      logger.info('Database connection established successfully');

      if (process.env.NODE_ENV === 'development') {
        await sequelize.sync({ alter: true });
        logger.info('Database synchronized');
      }
      return; // Success, exit the retry loop

    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed`, error, {
        attempt: i + 1,
        totalRetries: retries
      });

      if (i === retries - 1) {
        logger.error('All database connection attempts failed', error);
        process.exit(1);
      }

      logger.debug(`Waiting ${delay}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

module.exports = { app, connectDB };
