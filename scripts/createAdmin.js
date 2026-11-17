require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  try {
    console.log('[Seed Admin]: Connecting to database...');
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME?.trim();
    if (!adminEmail || !adminPassword || !adminName) {
      throw new Error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD before creating an admin.');
    }
    if (adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    }

    // Check if admin already exists
    const existing = await Admin.findOne({ email: adminEmail.toLowerCase() });
    if (existing) {
      console.log(`[Seed Admin]: Admin already exists with email: ${adminEmail}`);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const admin = await Admin.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'superadmin',
    });

    console.log(`[Seed Admin]: Provisioned ${admin.name} (${admin.email}) as ${admin.role}.`);
  } catch (error) {
    console.error('[Seed Admin Error]:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

seedAdmin();
