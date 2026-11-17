require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const seedAdmins = async () => {
  let accounts;
  try {
    accounts = JSON.parse(process.env.ADMIN_ACCOUNTS_JSON || '');
  } catch (error) {
    throw new Error('ADMIN_ACCOUNTS_JSON must be valid JSON containing an array of admin objects.');
  }
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('Set ADMIN_ACCOUNTS_JSON to an array of admin credentials before running this script.');
  }

  for (const [index, account] of accounts.entries()) {
    if (!account?.name || !account?.email || !account?.password) {
      throw new Error(`Admin entry ${index + 1} must include name, email, and password.`);
    }
    if (String(account.password).length < 12) {
      throw new Error(`Admin entry ${index + 1} password must be at least 12 characters.`);
    }
    if (!['admin', 'superadmin'].includes(account.role || 'admin')) {
      throw new Error(`Admin entry ${index + 1} has an invalid role.`);
    }
  }

  try {
    await connectDB();
    for (const account of accounts) {
      const email = account.email.trim().toLowerCase();
      const username = account.username?.trim().toLowerCase() || undefined;
      const passwordHash = await bcrypt.hash(account.password, 12);
      const identityFilter = username
        ? { $or: [{ email }, { username }] }
        : { email };
      await Admin.findOneAndUpdate(
        identityFilter,
        {
          $set: {
            name: account.name.trim(),
            email,
            username,
            passwordHash,
            role: account.role || 'admin',
            isEmailVerified: true,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      console.log(`[Seed Admins]: Provisioned ${email}`);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

seedAdmins().catch((error) => {
  console.error(`[Seed Admins Error]: ${error.message}`);
  process.exitCode = 1;
});
