require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');
const emailService = require('../utils/emailService');

const runShahidSenderTest = async () => {
  console.log('======================================================');
  console.log('   SENDER VERIFICATION: moh.shahid2004@gmail.com     ');
  console.log('======================================================\n');

  const senderUser = process.env.EMAIL_USER;
  const senderPass = process.env.EMAIL_PASS;
  const senderFrom = process.env.EMAIL_FROM;
  const targetRecipient = process.argv[2] || senderUser || 'moh.shahid2004@gmail.com';

  console.log('Configuration:');
  console.log(`  - Sender User (SMTP Auth) : ${senderUser || '(Not set)'}`);
  console.log(`  - Sender Display (From)   : ${senderFrom || '(Not set)'}`);
  console.log(`  - Target Recipient (To)   : ${targetRecipient}`);
  console.log(`  - App Password Status     : ${senderPass ? 'Configured (••••••••••••••••)' : 'NOT SET in server/.env'}\n`);

  if (!senderPass || senderPass.trim() === '') {
    console.log('------------------------------------------------------');
    console.log('NOTICE: GOOGLE APP PASSWORD IS NOT YET CONFIGURED');
    console.log('To send real emails from moh.shahid2004@gmail.com, you must:');
    console.log('1. Go to: https://myaccount.google.com/apppasswords');
    console.log('2. Log in with: moh.shahid2004@gmail.com');
    console.log('3. Enter an app name (e.g. Raheema Traders) and click Create.');
    console.log('4. Copy the 16-character code (e.g. abcd efgh ijkl mnop).');
    console.log('5. Paste into server/.env: EMAIL_PASS=abcdefghijklmnop');
    console.log('------------------------------------------------------\n');
    console.log('Testing fallback email delivery using Ethereal dev mailbox...');
  } else {
    console.log('Testing live Google SMTP connection (smtp.gmail.com:587)...');
  }

  try {
    const dummyResetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/reset-password/sample-token-123456789`;
    
    console.log(`Dispatching test password reset email to: ${targetRecipient}...`);
    const result = await emailService.sendPasswordResetEmail({
      to: targetRecipient,
      name: 'Administrator',
      resetUrl: dummyResetUrl,
    });

    console.log('\n======================================================');
    console.log('  TEST RESULT: SUCCESS!');
    console.log('======================================================');
    console.log(`  ✓ Message ID : ${result.messageId}`);
    if (result.previewUrl) {
      console.log(`  ✓ Dev Preview: ${result.previewUrl}`);
      console.log('  (Email generated in dev mode. Add EMAIL_PASS to deliver directly to real Gmail inbox.)');
    } else {
      console.log(`  ✓ Successfully dispatched from ${senderUser} to ${targetRecipient}!`);
      console.log('  Check the inbox for the password reset email.');
    }
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ FAILED TO DISPATCH EMAIL:');
    console.error(`  Error: ${err.message}\n`);

    if (err.message && err.message.includes('535') && err.message.includes('Username and Password not accepted')) {
      console.log('------------------------------------------------------');
      console.log('GOOGLE SMTP AUTHENTICATION FAILED (535):');
      console.log('Google rejected the password. Please verify:');
      console.log('1. You must use a 16-character Google "App Password", NOT your personal Google account password.');
      console.log('2. Generate one here: https://myaccount.google.com/apppasswords');
      console.log('------------------------------------------------------\n');
    }
    process.exit(1);
  }
};

runShahidSenderTest();
