require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Image = require('../models/Image');

const models = [Admin, Product, Category, Image];

const run = async () => {
  try {
    await connectDB({ autoIndex: false });
    let hasIssues = false;

    for (const Model of models) {
      const collection = Model.collection;
      const collectionExists = await mongoose.connection.db
        .listCollections({ name: collection.collectionName }, { nameOnly: true })
        .hasNext();
      const actual = collectionExists ? await collection.indexes() : [];
      const expected = Model.schema.indexes();
      const missing = expected.filter(([keys, options]) => {
        const found = actual.find((index) => JSON.stringify(index.key) === JSON.stringify(keys));
        return !found || Boolean(found.unique) !== Boolean(options.unique) || Boolean(found.sparse) !== Boolean(options.sparse);
      });

      console.log(`\n${Model.modelName} (${collection.collectionName})`);
      console.log(`  Indexes present: ${actual.length}`);
      if (missing.length) {
        hasIssues = true;
        console.log(`  Schema indexes not present in the database: ${missing.map(([keys]) => JSON.stringify(keys)).join(', ')}`);
      } else {
        console.log('  Schema indexes: present');
      }

      if (!collectionExists) {
        console.log('  Collection does not exist yet; duplicate scan skipped.');
        continue;
      }

      for (const [keys, options] of expected) {
        if (!options.unique || Object.keys(keys).length !== 1) continue;
        const [field] = Object.keys(keys);
        const duplicates = await collection.aggregate([
          { $match: { [field]: { $exists: true, $ne: null } } },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 10 },
          { $count: 'duplicateGroups' },
        ]).toArray();
        const duplicateGroups = duplicates[0]?.duplicateGroups || 0;
        if (duplicateGroups) {
          hasIssues = true;
          console.log(`  Duplicate values for unique field "${field}": at least ${duplicateGroups} group(s)`);
        }
      }
    }

    console.log('\nRead-only index diagnostic complete. No indexes or records were changed.');
    process.exitCode = hasIssues ? 1 : 0;
  } catch (error) {
    console.error(`Index diagnostic failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

run();
