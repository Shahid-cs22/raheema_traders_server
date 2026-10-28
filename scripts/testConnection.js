require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const testURI = async () => {
  const uri = process.env.MONGODB_URI;
  console.log('\n--- MongoDB Connection Diagnostic ---');
  console.log('Target URI:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'UNDEFINED');

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('\nSUCCESS: Connected to MongoDB Atlas cluster!');
    console.log(`Database Host: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err.message);
    process.exit(1);
  }
};

testURI();
