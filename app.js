const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const mongoose = require('mongoose');
const Image = require('./models/Image');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Trust reverse proxy headers (Render, Cloudflare, Vercel, AWS ALB)
// Required for accurate IP rate limiting without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration for frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://raheema-traders.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all in dev/preview if needed
    },
    credentials: true,
  })
);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dedicated persistent uploads route (Disk Cache + MongoDB Atlas permanent fallback)
app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Security: Sanitize filename with decodeURIComponent and path.basename to prevent path traversal
    let cleanFilename = filename;
    try {
      cleanFilename = decodeURIComponent(filename);
    } catch (e) {}
    const safeFilename = path.basename(cleanFilename);
    const uploadDir = path.join(__dirname, 'uploads');
    const localPath = path.join(uploadDir, safeFilename);

    // 1. Serve from local disk cache if present
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }

    // 2. Fallback to MongoDB Atlas Image buffer
    const img = await Image.findOne({ filename: safeFilename });
    if (img && img.data) {
      res.set('Content-Type', img.contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      // Async re-cache to local disk
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFile(localPath, img.data, () => {});
      } catch (cacheErr) {}
      return res.send(img.data);
    }

    // 3. Fallback placeholder if missing anywhere (prevents broken image in browser)
    return res.redirect('https://i.pinimg.com/736x/3b/f7/73/3bf773a3ef0c40967742270bba69b7c2.jpg');
  } catch (err) {
    next(err);
  }
});

// Rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/send-verification-email', authLimiter);

// Favicon handler to silence browser icon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Root endpoint (for Render/cloud root health probes - handles GET and HEAD)
app.all('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Raheema Traders REST API',
    message: 'Raheema Traders REST API is running',
    health: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint (handles GET and HEAD probes)
app.all('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(200).json({
    status: 'online',
    service: 'Kinetic Footwear API',
    database: dbStatusMap[dbState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Middleware to verify database connection before handling data queries
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message:
        'Database connection is not active. MongoDB Atlas rejected authentication (bad auth). Please check your database user and password in MongoDB Atlas (Security -> Database Access).',
    });
  }
  next();
};

// API Routes
app.use('/api/auth', checkDbConnection, authRoutes);
app.use('/api/products', checkDbConnection, productRoutes);
app.use('/api/admin', checkDbConnection, adminRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

module.exports = app;
