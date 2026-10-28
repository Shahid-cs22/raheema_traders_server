require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const authorizedAdmins = [
  {
    name: 'Moh Rashid',
    email: 'moh.rashid20006@gmail.com',
    password: 'rashidrt@06',
    role: 'admin',
  },
  {
    name: 'Sabeek',
    email: 'sabeek007@gmail.com',
    password: 'sahulhameedrt@77',
    role: 'admin',
  },
  {
    name: 'Moh Shahid',
    email: 'moh.shahid2004@gmail.com',
    password: 'shahidrt@ety',
    role: 'superadmin',
  },
  {
    name: 'Raheema Traders',
    username: 'raheematraders75',
    email: 'raheematraders75@gmail.com',
    password: 'raheematraders@1975',
    role: 'superadmin',
  },
];

const seedAllAdmins = async () => {
  try {
    console.log('[Seed Admins]: Connecting to MongoDB Atlas...');
    await connectDB();

    console.log('[Seed Admins]: Registering/Updating authorized administrators...');

    for (const user of authorizedAdmins) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(user.password, salt);

      const filter = user.username
        ? { $or: [{ email: user.email.toLowerCase() }, { username: user.username.toLowerCase() }] }
        : { email: user.email.toLowerCase() };

      const updateData = {
        name: user.name,
        email: user.email.toLowerCase(),
        passwordHash,
        role: user.role,
      };

      if (user.username) {
        updateData.username = user.username.toLowerCase();
      }

      await Admin.findOneAndUpdate(filter, updateData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      console.log(`  ✓ Configured: ${user.name} | ${user.username || user.email} (${user.role})`);
    }

    console.log(`
  ======================================================
    ALL 4 ADMINISTRATORS CONFIGURED IN MONGODB ATLAS!
  ======================================================
    1. moh.rashid20006@gmail.com    (password: rashidrt@06)
    2. sabeek007@gmail.com          (password: sahulhameedrt@77)
    3. moh.shahid2004@gmail.com     (password: shahidrt@ety)
    4. raheematraders75             (password: raheematraders@1975)
  ======================================================
    All 4 users can now log into /admin/login
  ======================================================
    `);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Admins Error]:', error.message);
    process.exit(1);
  }
};

seedAllAdmins();
