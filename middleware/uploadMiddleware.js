const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const Image = require('../models/Image');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'footwear-' + uniqueSuffix + ext);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, and .webp image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter,
});

/**
 * Dynamic public base URL (resolves active host in dev/production with Render fallback)
 */
const getPublicBaseUrl = (r) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
  if (r && typeof r.get === 'function') {
    const host = r.get('host');
    if (host) {
      return `${r.protocol || 'http'}://${host}`;
    }
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://raheema-traders-server.onrender.com'
    : `http://localhost:${process.env.PORT || 5000}`;
};

/**
 * Helper to upload a local file to Cloudinary if configured,
 * otherwise return local relative URL
 */
const processUploadedFile = async (req, file) => {
  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'kinetic-footwear',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });
      // Optionally remove local file after cloudinary upload
      fs.unlink(file.path, () => {});
      return result.secure_url;
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      // Fallback to public URL if Cloudinary fails
      const baseUrl = getPublicBaseUrl(req);
      return `${baseUrl}/uploads/${file.filename}`;
    }
  }

  // Always persist image buffer in MongoDB Atlas as a permanent backup against Render ephemeral wipes
  try {
    if (fs.existsSync(file.path)) {
      const buffer = fs.readFileSync(file.path);
      await Image.findOneAndUpdate(
        { filename: file.filename },
        {
          filename: file.filename,
          contentType: file.mimetype || 'image/jpeg',
          size: file.size,
          data: buffer,
        },
        { upsert: true, new: true }
      );
    }
  } catch (dbErr) {
    console.error('Failed to persist image to MongoDB Atlas:', dbErr.message);
  }

  // Public Cloud URL
  const baseUrl = getPublicBaseUrl(req);
  return `${baseUrl}/uploads/${file.filename}`;
};

module.exports = {
  upload,
  processUploadedFile,
  getPublicBaseUrl,
};
