const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Image = require('../models/Image');

const backupLocalUploads = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found.');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas.');

    const files = fs.readdirSync(uploadsDir);
    let count = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;
      const filePath = path.join(uploadsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(file).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.webp') contentType = 'image/webp';

        await Image.findOneAndUpdate(
          { filename: file },
          {
            filename: file,
            contentType,
            size: stat.size,
            data: buffer,
          },
          { upsert: true, new: true }
        );
        console.log(`  ⬆️ Uploaded to MongoDB: ${file}`);
        count++;
      }
    }

    console.log(`\n🎉 Seeded ${count} existing local image(s) to MongoDB Atlas.`);
  } catch (err) {
    console.error('❌ Error uploading to MongoDB:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas.');
  }
};

backupLocalUploads();
