const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/db');

module.exports = async (req, res) => {
  // Ensure DB connection is active before serving requests in serverless runtime
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.warn('[Serverless DB Warning]: Could not establish MongoDB connection:', err.message);
    }
  }
  return app(req, res);
};
