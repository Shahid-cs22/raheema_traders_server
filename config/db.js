const mongoose = require('mongoose');

// Disable query buffering so disconnected queries fail fast instead of hanging 10000ms
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic_footwear';
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    console.error(`
      ---------------------------------------------------------
      Notice: Could not connect to MongoDB at process.env.MONGODB_URI.
      If using MongoDB Atlas:
      1. Create a free cluster on https://cloud.mongodb.com
      2. Set MONGODB_URI in server/.env with your connection string
      ---------------------------------------------------------
    `);
    throw error;
  }
};

module.exports = connectDB;
