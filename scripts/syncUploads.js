const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Image = require('../models/Image');

const syncUploads = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas.');

    const images = await Image.find({});
    console.log(`📦 Found ${images.length} persistent image(s) in MongoDB Atlas.`);

    let syncedCount = 0;
    for (const img of images) {
      if (img.filename && img.data) {
        const destPath = path.join(uploadsDir, img.filename);
        fs.writeFileSync(destPath, img.data);
        console.log(`  💾 Downloaded: ${img.filename} (${(img.size / 1024).toFixed(1)} KB)`);
        syncedCount++;
      }
    }

    console.log(`\n🎉 Synchronization complete! ${syncedCount} image(s) written to ${uploadsDir}`);
  } catch (err) {
    console.error('❌ Error syncing uploads:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas.');
  }
};

syncUploads();
