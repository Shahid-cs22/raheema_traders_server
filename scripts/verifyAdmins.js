require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const verify = async () => {
  const identifier = process.env.ADMIN_IDENTIFIER?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!identifier || !password) {
    throw new Error('Set ADMIN_IDENTIFIER and ADMIN_PASSWORD to verify one administrator account.');
  }

  try {
    await connectDB();
    const admin = await Admin.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!admin || !(await admin.comparePassword(password))) {
      throw new Error('Administrator credentials were not accepted.');
    }
    console.log(`[Admin Verification]: Credentials accepted for ${admin.email} (${admin.role}).`);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

verify().catch((error) => {
  console.error(`[Admin Verification Error]: ${error.message}`);
  process.exitCode = 1;
});
