const app = require('../app');
const connectDB = require('../config/db');

let isConnected = false;

module.exports = async (req, res) => {
  // Ensure DB connection is established before serving requests in serverless runtime
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.warn('[Serverless DB Warning]: Connecting with offline state:', err.message);
    }
  }
  return app(req, res);
};
