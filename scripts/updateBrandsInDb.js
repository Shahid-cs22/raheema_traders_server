require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const connectDB = require('../config/db');

const updateBrands = async () => {
  try {
    console.log('[Brand Migration]: Connecting to database...');
    await connectDB();

    console.log('[Brand Migration]: Searching for products with brand "Raheema Traders"...');
    
    // Find all products with brand 'Raheema Traders' (case-insensitive)
    const filter = { brand: { $regex: /^raheema traders$/i } };
    const matchingProducts = await Product.find(filter);

    console.log(`[Brand Migration]: Found ${matchingProducts.length} product(s) to update.`);

    if (matchingProducts.length > 0) {
      for (const prod of matchingProducts) {
        prod.brand = 'Volant';
        if (prod.sku && prod.sku.startsWith('RT-')) {
          prod.sku = prod.sku.replace(/^RT-/, 'VOL-');
        }
        await prod.save();
        console.log(`  ✓ Updated [${prod._id}] "${prod.name}" -> brand: "Volant", sku: "${prod.sku}"`);
      }
      console.log(`\n[Brand Migration]: Successfully migrated ${matchingProducts.length} product(s) to brand "Volant"!`);
    } else {
      console.log('[Brand Migration]: No products found with brand "Raheema Traders". Database is already clean.');
    }

    // Summary of all distinct brands currently in database
    const distinctBrands = await Product.distinct('brand');
    console.log('\n[Brand Migration]: Current distinct brands in database:');
    console.log(distinctBrands.sort());

    await mongoose.connection.close();
    console.log('\n[Brand Migration]: Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('[Brand Migration Error]:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

updateBrands();
