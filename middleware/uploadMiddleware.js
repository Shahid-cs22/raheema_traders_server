const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

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
 * Helper to upload a local file to Cloudinary if configured,
 * otherwise return local relative URL
 */
const processUploadedFile = async (req, file) => {
  // Reliable public base URL (defaults to live Render cloud server)
  const getPublicBaseUrl = (r) => {
    if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
    const host = r ? r.get('host') : '';
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${r.protocol}://${host}`;
    }
    return 'https://raheema-traders-server.onrender.com';
  };

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

  // Public Cloud URL
  const baseUrl = getPublicBaseUrl(req);
  return `${baseUrl}/uploads/${file.filename}`;
};

module.exports = {
  upload,
  processUploadedFile,
};
