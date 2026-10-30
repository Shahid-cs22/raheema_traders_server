const Product = require('../models/Product');

// @desc    Get all public products with search, filtering, sorting & pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      gender,
      brand,
      size,
      minPrice,
      maxPrice,
      inStock,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const query = { isActive: true };

    // Search query (keyword regex on name, brand, description)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    // Category filter (supports single or comma-separated with smart alias expansion)
    if (category && category !== 'All') {
      const rawCategories = category.includes(',') ? category.split(',') : [category];
      const expandedCategories = new Set();
      rawCategories.forEach((c) => {
        const item = c.trim();
        const lower = item.toLowerCase();
        expandedCategories.add(item);
        if (
          lower.includes('umbrella') ||
          lower.includes('cap') ||
          lower.includes('umberlla')
        ) {
          expandedCategories.add('Umbrella & Cap');
          expandedCategories.add('Umbrella');
          expandedCategories.add('Cap');
        } else if (
          lower.includes('wallet') ||
          lower.includes('belt') ||
          lower.includes('waller')
        ) {
          expandedCategories.add('Belt & Wallet');
          expandedCategories.add('Belt');
          expandedCategories.add('Wallet');
        } else if (
          lower.includes('polish') ||
          lower.includes('sock') ||
          lower.includes('shouepolice')
        ) {
          expandedCategories.add('Shoe Polish & Socks');
          expandedCategories.add('Shoe Polish');
          expandedCategories.add('Socks');
        } else if (lower.includes('raincoat') || lower.includes('rain')) {
          expandedCategories.add('Raincoat');
          expandedCategories.add('Raincoats');
        }
      });
      query.category = { $in: Array.from(expandedCategories) };
    }

    // Gender filter
    if (gender && gender !== 'All') {
      query.gender = gender;
    }

    // Brand filter
    if (brand && brand !== 'All') {
      const brands = brand.includes(',') ? brand.split(',') : [brand];
      query.brand = { $in: brands };
    }

    // Size filter
    if (size) {
      query.sizes = size;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== '') {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && maxPrice !== '') {
        query.price.$lte = Number(maxPrice);
      }
    }

    // In-Stock filter
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    // Sorting options
    let sortOptions = { createdAt: -1 }; // default newest
    if (sort === 'price_asc') {
      sortOptions = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOptions = { price: -1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1 };
    } else if (sort === 'featured') {
      sortOptions = { isFeatured: -1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured products for home showcase (with automatic fallback to latest products)
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res, next) => {
  try {
    // 1. Fetch products specifically marked as featured first
    let products = await Product.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(8);

    // 2. If fewer than 8 featured products, backfill with newest active arrivals
    // This guarantees the landing showcase is always populated and never empty
    if (products.length < 8) {
      const existingIds = products.map((p) => p._id);
      const needed = 8 - products.length;
      const recentArrivals = await Product.find({
        isActive: true,
        _id: { $nin: existingIds },
      })
        .sort({ createdAt: -1 })
        .limit(needed);

      products = [...products, ...recentArrivals];
    }

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by Slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug.toLowerCase(),
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Footwear product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Footwear product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get distinct categories with product counts
// @route   GET /api/products/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
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
        name: 'Sports Shoes',
        slug: 'sports-shoes',
        image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=800&q=80',
        description: 'High-traction running, training & turf shoes',
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

    // Aggregate counts of active products for each category
    const categoryCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    categoryCounts.forEach((c) => {
      countMap[c._id] = c.count;
    });

    const categoriesWithCount = standardCategories.map((cat) => ({
      ...cat,
      productCount: countMap[cat.name] || 0,
    }));

    res.status(200).json({
      success: true,
      categories: categoriesWithCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get related products for product details page
// @route   GET /api/products/:id/related
// @access  Public
const getRelatedProducts = async (req, res, next) => {
  try {
    const currentProduct = await Product.findById(req.params.id);

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const related = await Product.find({
      _id: { $ne: currentProduct._id },
      category: currentProduct.category,
      isActive: true,
    })
      .limit(4)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products: related,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getFeaturedProducts,
  getProductById,
  getProductBySlug,
  getCategories,
  getRelatedProducts,
};
