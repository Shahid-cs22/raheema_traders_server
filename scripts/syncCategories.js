require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const connectDB = require('../config/db');

const standardCategories = [
  {
    name: "Men's Shoes",
    slug: 'mens-shoes',
    image: 'https://i.pinimg.com/736x/3b/f7/73/3bf773a3ef0c40967742270bba69b7c2.jpg',
    description: 'Authentic trainers, casuals & walking footwear',
  },
  {
    name: "Women's Shoes",
    slug: 'womens-shoes',
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    description: 'Comfort heels, flats, and daily lifestyle footwear',
  },
  {
    name: 'Sports Shoes',
    slug: 'sports-shoes',
    image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=800&q=80',
    description: 'High-traction running, training & turf shoes',
  },
  {
    name: 'Sandals',
    slug: 'sandals',
    image: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=800&q=80',
    description: 'Ergonomic slides, flip-flops & strap sandals',
  },
  {
    name: 'Formal Shoes',
    slug: 'formal-shoes',
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
    description: 'Handcrafted leather brogues, derbies & oxfords',
  },
  {
    name: 'Sneakers',
    slug: 'sneakers',
    image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80',
    description: 'Modern lifestyle trainers, street sneakers & canvas kicks',
  },
  {
    name: 'Raincoat',
    slug: 'raincoat',
    image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=800&q=80',
    description: 'Heavy-duty monsoon waterproof rainwear & suits',
  },
  {
    name: 'Umbrella & Cap',
    slug: 'umbrella-and-cap',
    image: 'https://images.unsplash.com/photo-1517438476312-10d79c077509?auto=format&fit=crop&w=800&q=80',
    description: 'Authentic Popy windproof umbrellas & sun caps',
  },
  {
    name: 'Belt & Wallet',
    slug: 'belt-and-wallet',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    description: 'Genuine leather belts, cardholders & wallets',
  },
  {
    name: 'Shoe Polish & Socks',
    slug: 'shoe-polish-and-socks',
    image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=800&q=80',
    description: 'Shoe care creams, polishes, brushes & cotton socks',
  },
];

const syncAllCategories = async () => {
  try {
    console.log('[Sync Categories]: Connecting to database...');
    await connectDB();

    console.log('[Sync Categories]: Synchronizing 10 canonical categories...');
    for (const cat of standardCategories) {
      await Category.findOneAndUpdate(
        { name: cat.name },
        {
          name: cat.name,
          slug: cat.slug,
          image: cat.image,
          description: cat.description,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`  ✓ Synced Category: ${cat.name} (${cat.slug})`);
    }

    console.log('\n[Sync Categories]: All 10 categories successfully synchronized in MongoDB!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Sync Categories Error]:', err.message);
    process.exit(1);
  }
};

syncAllCategories();
