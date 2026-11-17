const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
} = require('../controllers/authController');
const { protectAdmin, optionalAdmin } = require('../middleware/authMiddleware');

// Standard Auth
router.post('/login', login);
router.get('/me', protectAdmin, getMe);

// Forgot / Reset Password
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Email Verification
router.post('/send-verification-email', optionalAdmin, sendVerificationEmail);
router.get('/verify-email/:token', verifyEmail);

module.exports = router;
