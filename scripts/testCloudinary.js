require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;

const runCloudinaryDiagnostics = async () => {
  console.log('======================================================');
  console.log('            CLOUDINARY INTEGRATION DIAGNOSTIC         ');
  console.log('======================================================\n');

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  console.log('Configured values:');
  console.log(`  - Cloud Name : ${cloudName || '(Not set)'}`);
  console.log(`  - API Key    : ${apiKey || '(Not set)'}`);
  console.log(`  - API Secret : ${apiSecret ? '••••••••' + apiSecret.slice(-4) : '(Not set)'}\n`);

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('✗ ERROR: Missing one or more Cloudinary environment variables in server/.env.');
    console.error('Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.\n');
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log('[1/3] Pinging Cloudinary API server...');
  try {
    const pingResult = await cloudinary.api.ping();
    console.log(`  ✓ Ping successful! Status: ${pingResult.status || 'ok'}`);
    console.log(`  ✓ Successfully connected to Cloudinary cloud: "${cloudName}"\n`);
  } catch (err) {
    const msg = (err && (err.message || (err.error && err.error.message))) || JSON.stringify(err);
    const httpCode = (err && (err.http_code || (err.error && err.error.http_code))) || 'Unknown';
    console.error('  ✗ Cloudinary Ping Failed:');
    console.error(`    HTTP Code: ${httpCode}`);
    console.error(`    Message  : ${msg}\n`);

    if (msg && msg.includes('cloud_name mismatch')) {
      console.log('------------------------------------------------------');
      console.log('ACTION REQUIRED: CLOUD NAME MISMATCH');
      console.log('The API Key and Secret are valid, but the Cloud Name');
      console.log(`"${cloudName}" does NOT match your Cloudinary account.`);
      console.log('');
      console.log('How to get your real Cloud Name:');
      console.log('1. Go to https://console.cloudinary.com/');
      console.log('2. Click on "Dashboard" (Home icon on the left menu).');
      console.log('3. Under "Product Environment Details", copy "Cloud Name".');
      console.log('4. Replace CLOUDINARY_CLOUD_NAME in server/.env.');
      console.log('------------------------------------------------------\n');
    }
    process.exit(1);
  }

  console.log('[2/3] Uploading test asset (1x1 transparent PNG pixel)...');
  let publicId = null;
  try {
    const testPixelBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadResult = await cloudinary.uploader.upload(testPixelBase64, {
      folder: 'kinetic-footwear/test',
      public_id: `test-ping-${Date.now()}`,
    });

    publicId = uploadResult.public_id;
    console.log(`  ✓ Upload successful!`);
    console.log(`  ✓ Secure CDN URL: ${uploadResult.secure_url}`);
    console.log(`  ✓ Public ID     : ${publicId}\n`);
  } catch (uploadErr) {
    console.error('  ✗ Test Upload Failed:', uploadErr.message);
    process.exit(1);
  }

  console.log('[3/3] Cleaning up test asset...');
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      console.log(`  ✓ Test asset deleted from Cloudinary storage.`);
    }
  } catch (cleanupErr) {
    console.warn('  ! Warning during cleanup:', cleanupErr.message);
  }

  console.log('\n======================================================');
  console.log('  SUCCESS: Cloudinary is 100% operational for uploads!');
  console.log('======================================================\n');
  process.exit(0);
};

runCloudinaryDiagnostics();
