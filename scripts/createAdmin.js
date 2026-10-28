require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  try {
    console.log('[Seed Admin]: Connecting to database...');
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kinetic.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.ADMIN_NAME || 'Kinetic Super Admin';

    // Check if admin already exists
    const existing = await Admin.findOne({ email: adminEmail.toLowerCase() });
    if (existing) {
      console.log(`[Seed Admin]: Admin already exists with email: ${adminEmail}`);
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const admin = await Admin.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'superadmin',
    });

    console.log(`
  ======================================================
    ADMIN SEEDED SUCCESSFULLY!
  ======================================================
    Name:     ${admin.name}
    Email:    ${admin.email}
    Password: ${adminPassword}
    Role:     ${admin.role}
  ======================================================
    Use these credentials to log in at /admin/login
  ======================================================
    `);

    process.exit(0);
  } catch (error) {
    console.error('[Seed Admin Error]:', error.message);
    process.exit(1);
  }
};

seedAdmin();
