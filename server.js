require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start Server after attempting DB connection
const startServer = async () => {
  try {
    await connectDB();
    console.log('[Database]: Connected successfully');
  } catch (error) {
    console.warn('[Database Warning]: Server starting with offline/unconnected DB state:', error.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`
  ======================================================
    KINETIC FOOTWEAR - REST API SERVER RUNNING
  ======================================================
    Port:        ${PORT}
    Environment: ${process.env.NODE_ENV || 'development'}
    API Base:    http://localhost:${PORT}/api
    Health:      http://localhost:${PORT}/api/health
    Admin Docs:  http://localhost:${PORT}/api/admin/dashboard
  ======================================================
    `);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`[Unhandled Rejection]: ${err.message}`);
    // Keep server running in development
  });
};

startServer();
