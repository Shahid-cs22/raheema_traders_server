const mongoose = require('mongoose');

// Disable query buffering so disconnected queries fail fast instead of hanging 10000ms
mongoose.set('bufferCommands', false);

let connectPromise = null;

const connectDB = async ({ autoIndex = process.env.NODE_ENV !== 'production' } = {}) => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  const uri = process.env.MONGODB_URI || (
    process.env.NODE_ENV === 'development'
      ? 'mongodb://127.0.0.1:27017/kinetic_footwear'
      : ''
  );
  if (!uri) {
    throw new Error('MONGODB_URI must be configured outside development.');
  }

  connectPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
    minPoolSize: 0,
    autoIndex,
  }).then((conn) => {
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  }).catch((error) => {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    throw error;
  }).finally(() => {
    connectPromise = null;
  });

  try {
    return await connectPromise;
  } catch (error) {
    throw error;
  }
};

module.exports = connectDB;
