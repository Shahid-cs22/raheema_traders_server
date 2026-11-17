require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const Admin = require('../models/Admin');
const emailService = require('../utils/emailService');

const runEmailAndAuthTests = async () => {
  console.log('======================================================');
  console.log('  TESTING ADMIN EMAIL VERIFICATION & FORGOT PASSWORD  ');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const testAssert = (desc, condition) => {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS]: ${desc}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL]: ${desc}`);
    }
  };

  try {
    // 1. Test Admin Model Schema Methods
    console.log('[1/4] Testing Admin Model Token Methods...');
    const testAdmin = new Admin({
      name: 'Test Administrator',
      email: 'test.admin@example.com',
      username: 'testadmin',
      passwordHash: 'dummyhash',
      isEmailVerified: false,
    });

    // Test Password Reset Token
    const rawResetToken = testAdmin.createPasswordResetToken();
    testAssert('Raw reset token is a 64-char hex string', typeof rawResetToken === 'string' && rawResetToken.length === 64);
    testAssert('Admin has hashed resetPasswordToken', typeof testAdmin.resetPasswordToken === 'string' && testAdmin.resetPasswordToken.length === 64);
    testAssert('resetPasswordExpires is set in the future (15 mins)', testAdmin.resetPasswordExpires > Date.now());

    // Verify SHA-256 match
    const computedResetHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    testAssert('Computed SHA-256 matches resetPasswordToken', computedResetHash === testAdmin.resetPasswordToken);

    // Test Email Verification Token
    const rawVerifyToken = testAdmin.createEmailVerificationToken();
    testAssert('Raw verification token is a 64-char hex string', typeof rawVerifyToken === 'string' && rawVerifyToken.length === 64);
    testAssert('Admin has hashed emailVerificationToken', typeof testAdmin.emailVerificationToken === 'string' && testAdmin.emailVerificationToken.length === 64);
    testAssert('emailVerificationExpires is set in the future (24 hours)', testAdmin.emailVerificationExpires > Date.now());

    const computedVerifyHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    testAssert('Computed SHA-256 matches emailVerificationToken', computedVerifyHash === testAdmin.emailVerificationToken);

    // 2. Test Nodemailer Email Dispatch - Password Reset
    console.log('\n[2/4] Testing Nodemailer Password Reset Dispatch...');
    const resetResult = await emailService.sendPasswordResetEmail({
      to: 'test.admin@example.com',
      name: 'Test Administrator',
      resetUrl: `http://localhost:5173/admin/reset-password/${rawResetToken}`,
    });
    testAssert('Password reset email sent successfully', resetResult.success === true && !!resetResult.messageId);

    // 3. Test Nodemailer Email Dispatch - Email Verification
    console.log('\n[3/4] Testing Nodemailer Email Verification Dispatch...');
    const verifyResult = await emailService.sendVerificationEmail({
      to: 'test.admin@example.com',
      name: 'Test Administrator',
      verificationUrl: `http://localhost:5173/admin/verify-email/${rawVerifyToken}`,
    });
    testAssert('Verification email sent successfully', verifyResult.success === true && !!verifyResult.messageId);

    // 4. Test Nodemailer Email Dispatch - Confirmation Alert
    console.log('\n[4/4] Testing Password Changed Confirmation Email...');
    const confirmResult = await emailService.sendPasswordResetSuccessEmail({
      to: 'test.admin@example.com',
      name: 'Test Administrator',
    });
    testAssert('Password changed alert email sent successfully', confirmResult.success === true && !!confirmResult.messageId);

    console.log('\n======================================================');
    console.log(`  SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
    console.log('======================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('\n[Test Execution Failed]:', err);
    process.exit(1);
  }
};

runEmailAndAuthTests();
