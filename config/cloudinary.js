const cloudinary = require('cloudinary').v2;

const cloudinaryValues = {
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
};
const hasCloudinaryValue = Object.values(cloudinaryValues).some(Boolean);
const isCloudinaryConfigured = Object.values(cloudinaryValues).every(Boolean);

if (hasCloudinaryValue && !isCloudinaryConfigured) {
  throw new Error('Cloudinary configuration is incomplete. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together.');
}

if (isCloudinaryConfigured) {
  cloudinary.config({
    ...cloudinaryValues,
  });
  console.log('[Cloudinary Configured]: Active');
} else {
  console.log('[Cloudinary Not Configured]: Falling back to local static image upload');
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
