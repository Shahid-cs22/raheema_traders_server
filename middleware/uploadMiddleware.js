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
  const allowedTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = allowedTypes[ext] === file.mimetype;

  if (mimetype) {
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
 * Save a durable MongoDB copy for local fallback. The disk copy is retained
 * so local development and a temporary DB outage can still serve the upload.
 */
const persistImageBackup = async (file) => {
  const buffer = await fs.promises.readFile(file.path);
  await Image.findOneAndUpdate(
    { filename: file.filename },
    {
      filename: file.filename,
      contentType: file.mimetype || 'image/jpeg',
      size: file.size,
      data: buffer,
    },
    { upsert: true, new: true, runValidators: true }
  );
};

const createLocalImageUrl = (req, file) => `${getPublicBaseUrl(req)}/uploads/${encodeURIComponent(file.filename)}`;

const processUploadedFile = async (req, file) => {
  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'kinetic-footwear',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });
      if (!result?.secure_url) throw new Error('Cloudinary did not return a secure asset URL.');
      await fs.promises.unlink(file.path).catch((error) => {
        console.warn(`[Upload]: Could not remove temporary file ${file.filename}: ${error.message}`);
      });
      return result.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]: Falling back to local storage:', err.message);
      try {
        await persistImageBackup(file);
      } catch (dbErr) {
        console.error('[Image Backup Error]: Could not persist Cloudinary fallback image:', dbErr.message);
        const fallbackError = new Error('Cloudinary is unavailable and the local image backup could not be stored.');
        fallbackError.statusCode = 503;
        throw fallbackError;
      }
      return createLocalImageUrl(req, file);
    }
  }

  try {
    await persistImageBackup(file);
  } catch (dbErr) {
    console.error('[Image Backup Error]: Could not persist local upload:', dbErr.message);
    const backupError = new Error('Local image backup could not be stored.');
    backupError.statusCode = 503;
    throw backupError;
  }

  return createLocalImageUrl(req, file);
};

module.exports = {
  upload,
  processUploadedFile,
  getPublicBaseUrl,
};
