const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const authRoutes = require('./authRoutes');
const serviceRoutes = require('./service_api');
const userRoutes = require('./user_api');
const providerRoutes = require('./provider_api');
const adminRoutes = require('./admin_api');
const glossaryRoutes = require('./glossary_api');
const savedConfigurationsRoutes = require('./saved_configurations_api');

const app = express();

// Middleware
app.use(express.json());

// CORS Configuration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: 'Too many login attempts, try again later', code: 'RATE_LIMIT_EXCEEDED' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 150,
  message: { success: false, error: 'Too many requests, try again later', code: 'RATE_LIMIT_EXCEEDED' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// Root test route
app.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes); // For service management and document upload
app.use('/api/provider', providerRoutes); // For provider-specific endpoints
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/glossary', glossaryRoutes); // For glossary and UoM costs
app.use('/api/saved-configurations', savedConfigurationsRoutes);

// Global Error Handler
app.use((error, req, res, next) => {
  console.error('Global Error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details,
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTHENTICATION_ERROR',
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});