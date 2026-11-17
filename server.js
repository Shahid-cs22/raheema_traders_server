require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
let reconnectTimer;

const scheduleDbReconnect = () => {
  if (reconnectTimer || process.env.NODE_ENV === 'test') return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (mongoose.connection.readyState === 1) return;
    try {
      await connectDB();
    } catch (error) {
      console.warn('[Database]: Reconnect attempt failed; retrying in 30 seconds.');
      scheduleDbReconnect();
    }
  }, 30000);
  reconnectTimer.unref?.();
};

// Start Server after attempting DB connection
const startServer = async () => {
  try {
    await connectDB();
    console.log('[Database]: Connected successfully');
  } catch (error) {
    console.warn('[Database Warning]: Server starting with offline/unconnected DB state:', error.message);
    scheduleDbReconnect();
  }

  mongoose.connection.on('disconnected', scheduleDbReconnect);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ======================================================
    RAHEEMA TRADERS - REST API SERVER RUNNING
  ======================================================
    Port:        ${PORT}
    Environment: ${process.env.NODE_ENV || 'development'}
    API Base:    http://localhost:${PORT}/api
    Health:      http://localhost:${PORT}/api/health
    Admin Docs:  http://localhost:${PORT}/api/admin/dashboard
  ======================================================
    `);
  });

  // Graceful shutdown helper
  const shutdown = async (signal) => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log(`\n[Server]: Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[Server]: HTTP server closed to new requests.');
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          console.log('[Server]: MongoDB connection closed gracefully.');
        }
      } catch (dbCloseErr) {
        console.warn('[Server]: Error closing MongoDB connection:', dbCloseErr.message);
      }
      process.exit(0);
    });

    // Force shutdown after timeout if connections hang
    setTimeout(() => {
      console.error('[Server]: Forceful shutdown after 10-second timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Global unhandled promise rejection handler
  process.on('unhandledRejection', (err) => {
    console.error('[Unhandled Rejection]:', err ? (err.stack || err.message || err) : 'Unknown rejection');
  });

  // Global uncaught exception handler
  process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception]:', err ? (err.stack || err.message || err) : 'Unknown exception');
  });
};

startServer();
