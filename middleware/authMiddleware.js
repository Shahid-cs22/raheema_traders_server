const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectAdmin = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kinetic_super_secret_jwt_key_2026_modern_footwear');
    const admin = await Admin.findById(decoded.id).select('-passwordHash');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'The admin associated with this token no longer exists.',
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.',
    });
  }
};

const optionalAdmin = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'kinetic_super_secret_jwt_key_2026_modern_footwear'
    );
    const admin = await Admin.findById(decoded.id).select('-passwordHash');
    if (admin) {
      req.admin = admin;
    }
  } catch (error) {
    // Silently proceed for optional auth
  }

  next();
};

module.exports = { protectAdmin, optionalAdmin };
