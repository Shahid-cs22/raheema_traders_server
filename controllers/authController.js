const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const emailService = require('../utils/emailService');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'kinetic_super_secret_jwt_key_2026_modern_footwear',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

// @desc    Authenticate admin & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password',
      });
    }

    const admin = await Admin.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(admin._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        isEmailVerified: Boolean(admin.isEmailVerified),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in admin profile
// @route   GET /api/auth/me
// @access  Private/Admin
const getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin._id).select(
      '-passwordHash -resetPasswordToken -emailVerificationToken'
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        isEmailVerified: Boolean(admin.isEmailVerified),
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate forgot password request and send email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const rawIdentifier = req.body.email || req.body.username || req.body.identifier;
    const identifier = (rawIdentifier || '').toLowerCase().trim();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered admin email or username',
      });
    }

    const admin = await Admin.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!admin) {
      // Respond with success to prevent account enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account with that identifier exists, a password reset link has been dispatched to its registered email.',
      });
    }

    // Generate secure token and save
    const resetToken = admin.createPasswordResetToken();
    await admin.save({ validateBeforeSave: false });

    // Build reset URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/admin/reset-password/${resetToken}`;

    try {
      await emailService.sendPasswordResetEmail({
        to: admin.email,
        name: admin.name,
        resetUrl,
      });

      return res.status(200).json({
        success: true,
        message: 'Password reset link sent to your registered email address.',
      });
    } catch (mailError) {
      // Revert token if email dispatch fails completely
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpires = undefined;
      await admin.save({ validateBeforeSave: false });

      console.error('[Forgot Password Error]: Failed to dispatch reset email:', mailError.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to send password reset email at this moment. Please check server email configuration or try again later.',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using valid reset token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is missing',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Hash token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link. Please request a new one.',
      });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    admin.passwordHash = await bcrypt.hash(password, salt);
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    // Async confirmation email
    try {
      await emailService.sendPasswordResetSuccessEmail({
        to: admin.email,
        name: admin.name,
      });
    } catch (emailErr) {
      console.warn('[Reset Password]: Confirmation email alert could not be sent:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send email verification link
// @route   POST /api/auth/send-verification-email
// @access  Public or Protected
const sendVerificationEmail = async (req, res, next) => {
  try {
    let admin = null;

    if (req.admin && req.admin._id) {
      admin = await Admin.findById(req.admin._id);
    } else {
      const rawIdentifier = req.body.email || req.body.username || req.body.identifier;
      const identifier = (rawIdentifier || '').toLowerCase().trim();

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: 'Please provide your email address',
        });
      }

      admin = await Admin.findOne({
        $or: [{ email: identifier }, { username: identifier }],
      });
    }

    if (!admin) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a verification link has been sent.',
      });
    }

    if (admin.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Your email address is already verified.',
      });
    }

    const verificationToken = admin.createEmailVerificationToken();
    await admin.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verificationUrl = `${clientUrl}/admin/verify-email/${verificationToken}`;

    try {
      await emailService.sendVerificationEmail({
        to: admin.email,
        name: admin.name,
        verificationUrl,
      });

      return res.status(200).json({
        success: true,
        message: 'Verification link sent to your registered email address. Please check your inbox.',
      });
    } catch (mailError) {
      admin.emailVerificationToken = undefined;
      admin.emailVerificationExpires = undefined;
      await admin.save({ validateBeforeSave: false });

      console.error('[Verification Email Error]: Failed to dispatch verification email:', mailError.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to send verification email at this moment. Please check server email configuration or try again later.',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify admin email address with token
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Email verification token is missing',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired email verification link. Please request a new verification email.',
      });
    }

    admin.isEmailVerified = true;
    admin.emailVerificationToken = undefined;
    admin.emailVerificationExpires = undefined;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Email address successfully verified! Your administrator account is now fully validated.',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        isEmailVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
