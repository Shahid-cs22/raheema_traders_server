require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Category = require('../models/Category');

const runAuditTestSuite = async () => {
  console.log('======================================================');
  console.log('         MODELS & BACKEND AUDIT VERIFICATION          ');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assertTest = (desc, condition) => {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS]: ${desc}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL]: ${desc}`);
    }
  };

  try {
    // -----------------------------------------------------------------
    // 1. ADMIN MODEL: Sparse Index & Empty Username Normalization
    // -----------------------------------------------------------------
    console.log('[1/4] Testing Admin Model Username Normalization...');
    const adminWithEmptyUsername = new Admin({
      name: 'Audit Admin',
      email: 'audit.admin@example.com',
      username: '   ',
      passwordHash: 'dummyhash',
    });
    await adminWithEmptyUsername.validate();
    assertTest(
      'Whitespace username is normalized to undefined (prevents E11000 sparse collision)',
      adminWithEmptyUsername.username === undefined
    );

    const adminWithValidUsername = new Admin({
      name: 'Audit Admin 2',
      email: 'audit.admin2@example.com',
      username: 'auditadmin2',
      passwordHash: 'dummyhash',
    });
    await adminWithValidUsername.validate();
    assertTest(
      'Valid username is preserved as lowercase trimmed',
      adminWithValidUsername.username === 'auditadmin2'
    );

    // -----------------------------------------------------------------
    // 2. PRODUCT MODEL: Pre-Validate Hooks (Slug, SKU, Images, Sizes)
    // -----------------------------------------------------------------
    console.log('\n[2/4] Testing Product Model Pre-Validate Hooks & Fallbacks...');
    
    // Auto-generate slug from name
    const productAutoSlug = new Product({
      name: 'Air Velocity Runner',
      category: "Men's Shoes",
      brand: 'Volant',
      price: 150,
      images: ['https://example.com/shoe.jpg'],
    });
    await productAutoSlug.validate();
    assertTest('Auto-generates slug from product name', productAutoSlug.slug === 'air-velocity-runner');
    assertTest('Auto-generates structured SKU when absent', typeof productAutoSlug.sku === 'string' && productAutoSlug.sku.startsWith('VOL-ME-'));

    // Symbols/emoji fallback slug
    const productSymbols = new Product({
      name: '👟✨🔥',
      category: 'Sports Shoes',
      brand: 'Leeds',
      price: 100,
      images: ['https://example.com/shoe.jpg'],
    });
    await productSymbols.validate();
    assertTest('Symbol/emoji-only name falls back safely to footwear-<timestamp> slug', productSymbols.slug.startsWith('footwear-'));

    // Image array sanitization
    const productDirtyImages = new Product({
      name: 'Clean Image Test',
      category: 'Sandals',
      price: 50,
      images: ['  https://example.com/pic1.jpg  ', '', '   ', 'https://example.com/pic2.jpg'],
    });
    await productDirtyImages.validate();
    assertTest('Sanitizes image array by trimming and stripping empty strings', 
      productDirtyImages.images.length === 2 && 
      productDirtyImages.images[0] === 'https://example.com/pic1.jpg' && 
      productDirtyImages.images[1] === 'https://example.com/pic2.jpg'
    );

    // Sizes array sanitization
    const productDirtySizes = new Product({
      name: 'Clean Sizes Test',
      category: 'Formal Shoes',
      price: 200,
      images: ['https://example.com/formal.jpg'],
      sizes: [' 7 ', '8', '   ', '9 '],
      colors: [' Black ', ' White '],
    });
    await productDirtySizes.validate();
    assertTest('Sanitizes sizes array', productDirtySizes.sizes.length === 3 && productDirtySizes.sizes[0] === '7');
    assertTest('Sanitizes colors array', productDirtySizes.colors.length === 2 && productDirtySizes.colors[0] === 'Black');

    // -----------------------------------------------------------------
    // 3. PRODUCT MODEL: Discount Price Validation
    // -----------------------------------------------------------------
    console.log('\n[3/4] Testing Product Model Discount Price Validation...');

    // Valid discount
    const validDiscountProd = new Product({
      name: 'Discount Valid',
      category: 'Sneakers',
      price: 100,
      discountPrice: 80,
      images: ['https://example.com/pic.jpg'],
    });
    let validDiscountError = null;
    try {
      await validDiscountProd.validate();
    } catch (e) {
      validDiscountError = e;
    }
    assertTest('Valid discount price (80 < 100) passes validation', validDiscountError === null);

    // Invalid discount (greater than price)
    const invalidDiscountProd = new Product({
      name: 'Discount Invalid High',
      category: 'Sneakers',
      price: 100,
      discountPrice: 120,
      images: ['https://example.com/pic.jpg'],
    });
    let highDiscountError = null;
    try {
      await invalidDiscountProd.validate();
    } catch (e) {
      highDiscountError = e;
    }
    assertTest('Discount price exceeding regular price (120 > 100) fails validation', highDiscountError !== null);

    // Invalid discount (zero or negative)
    const zeroDiscountProd = new Product({
      name: 'Discount Invalid Zero',
      category: 'Sneakers',
      price: 100,
      discountPrice: 0,
      images: ['https://example.com/pic.jpg'],
    });
    let zeroDiscountError = null;
    try {
      await zeroDiscountProd.validate();
    } catch (e) {
      zeroDiscountError = e;
    }
    assertTest('Discount price of 0 fails validation', zeroDiscountError !== null);

    // Sneakers category validation
    assertTest('Sneakers category passes enum validation in Product model', validDiscountProd.category === 'Sneakers');

    // -----------------------------------------------------------------
    // 4. CATEGORY MODEL & REGEX SEARCH UTILITY
    // -----------------------------------------------------------------
    console.log('\n[4/4] Testing Category Model & Search Regex Escaping...');

    // Category auto-slug
    const testCat = new Category({
      name: 'Outdoor Trekking',
    });
    await testCat.validate();
    assertTest('Category model auto-generates slug from name', testCat.slug === 'outdoor-trekking');

    // Regex escaping utility
    const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const complexSearchQueries = [
      'Nike (Air Max)',
      'Adidas+',
      'Volant [Pro]',
      'Special*Deal?',
      'Price $100 & More',
    ];

    let allRegexPassed = true;
    for (const q of complexSearchQueries) {
      try {
        const escaped = escapeRegex(q);
        const regex = new RegExp(escaped, 'i');
        if (!regex.test(q)) allRegexPassed = false;
      } catch (e) {
        allRegexPassed = false;
      }
    }
    assertTest('Complex search queries with ()[]+*?$ regex chars execute without syntax crash', allRegexPassed);

    console.log('\n======================================================');
    console.log(`  AUDIT SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED!`);
    console.log('======================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('\n[Audit Test Error]:', err);
    process.exit(1);
  }
};

runAuditTestSuite();
