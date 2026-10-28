require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const testCases = [
  { id: 'moh.rashid20006@gmail.com', pass: 'rashidrt@06' },
  { id: 'sabeek007@gmail.com', pass: 'sahulhameedrt@77' },
  { id: 'moh.shahid2004@gmail.com', pass: 'shahidrt@ety' },
  { id: 'raheematraders75', pass: 'raheematraders@1975' },
];

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const t of testCases) {
    const admin = await Admin.findOne({
      $or: [{ email: t.id.toLowerCase() }, { username: t.id.toLowerCase() }],
    });
    if (!admin) throw new Error('Not found: ' + t.id);
    const ok = await admin.comparePassword(t.pass);
    if (!ok) throw new Error('Password mismatch for: ' + t.id);
    console.log(`✅ VERIFIED: ${admin.name} [${t.id}] - Role: ${admin.role}`);
  }
  await mongoose.disconnect();
  console.log('\n🎉 ALL 4 ADMINISTRATOR ACCOUNTS VERIFIED AND READY IN ATLAS!');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
