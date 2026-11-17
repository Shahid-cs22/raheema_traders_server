const slugify = require('slugify');
const Product = require('../models/Product');
const Image = require('../models/Image');
const { processUploadedFile } = require('../middleware/uploadMiddleware');

// Helper to escape regex special characters to prevent search query crashes
const escapeRegex = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Helper to generate unique SKU
const generateSKU = (brand, category) => {
  const brandCode = (brand || 'VOL').substring(0, 3).toUpperCase();
  const catCode = (category || 'SH').substring(0, 2).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${brandCode}-${catCode}-${randomNum}`;
};

// Helper to safely parse JSON arrays, comma-delimited strings, or plain arrays
const safeParseArray = (val, fallback = []) => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch (e) {
      if (val.includes(',')) {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return val.trim() ? [val.trim()] : fallback;
    }
  }
  return fallback;
};

// Helper to normalize category variations, aliases, and typos to canonical categories
const normalizeCategory = (cat) => {
  if (!cat || typeof cat !== 'string') return cat;
  const c = cat.trim();
  const lower = c.toLowerCase();
  if (
    lower === 'umbrella' ||
    lower === 'cap' ||
    lower.includes('umbrella') ||
    lower.includes('cap') ||
    lower.includes('umberlla')
  ) {
    return 'Umbrella & Cap';
  }
  if (
    lower === 'wallet' ||
    lower === 'belt' ||
    lower.includes('wallet') ||
    lower.includes('belt') ||
    lower.includes('waller')
  ) {
    return 'Belt & Wallet';
  }
  if (
    lower === 'shoepolish' ||
    lower === 'shoe polish' ||
    lower === 'socks' ||
    lower === 'sock' ||
    lower.includes('polish') ||
    lower.includes('sock') ||
    lower.includes('shouepolice')
  ) {
    return 'Shoe Polish & Socks';
  }
  if (lower.includes('raincoat') || lower.includes('rain coat') || lower.includes('rain')) {
    return 'Raincoat';
  }
  if (lower.includes('sandal') || lower.includes('slide') || lower.includes('flip')) {
    return 'Sandals';
  }
  if (lower.includes('formal') || lower.includes('leather')) {
    return 'Formal Shoes';
  }
  if (lower.includes('sport') || lower.includes('running') || lower.includes('trainer')) {
    return 'Sports Shoes';
  }
  if (lower.includes('sneaker')) {
    return 'Sneakers';
  }
  if (lower.includes('women')) {
    return "Women's Shoes";
  }
  if (lower.includes('men')) {
    return "Men's Shoes";
  }
  return c;
};

// @desc    Get dashboard metrics & summary
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const outOfStockProducts = await Product.countDocuments({ stock: 0 });
    const lowStockProducts = await Product.countDocuments({
      stock: { $gt: 0, $lte: 5 },
    });

    const categoryBreakdown = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name brand category price stock isActive isFeatured images createdAt');

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        lowStockProducts,
        totalCategories: categoryBreakdown.length,
      },
      categoryBreakdown,
      recentProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all products for admin table (includes inactive)
// @route   GET /api/admin/products
// @access  Private/Admin
const getAllProductsAdmin = async (req, res, next) => {
  try {
    const { search, category, brand, status, sort, page = 1, limit = 10 } = req.query;

    const query = {};

    if (search && search.trim()) {
      const sanitized = escapeRegex(search.trim());
      const searchRegex = new RegExp(sanitized, 'i');
      query.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { sku: searchRegex },
        { category: searchRegex },
      ];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (brand && brand !== 'All') {
      query.brand = brand;
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'out_of_stock') {
      query.stock = 0;
    } else if (status === 'low_stock') {
      query.stock = { $gt: 0, $lte: 5 };
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    if (sort === 'price_desc') sortOptions = { price: -1 };
    if (sort === 'stock_asc') sortOptions = { stock: 1 };
    if (sort === 'stock_desc') sortOptions = { stock: -1 };
    if (sort === 'name_asc') sortOptions = { name: 1 };

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
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new footwear product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    let {
      name,
      slug,
      brand,
      category,
      gender,
      description,
      price,
      discountPrice,
      images,
      sizes,
      colors,
      stock,
      sku,
      isFeatured,
      isActive,
    } = req.body;

    if (!name || !category || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: 'Name, Category, and Price are required fields',
      });
    }

    category = normalizeCategory(category);

    const finalDescription = description && description.trim()
      ? description.trim()
      : `Authentic ${name} from Raheema Traders, Karungal.`;

    // Auto-generate or sanitize slug
    if (!slug || !slug.trim()) {
      slug = slugify(name, { lower: true, strict: true });
    } else {
      slug = slugify(slug, { lower: true, strict: true });
    }

    // Check slug uniqueness
    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Auto-generate SKU if absent
    if (!sku || !sku.trim()) {
      sku = generateSKU(brand, category);
    } else {
      sku = sku.toUpperCase().trim();
      const existingSku = await Product.findOne({ sku });
      if (existingSku) {
        sku = `${sku}-${Date.now().toString().slice(-4)}`;
      }
    }

    // Process uploaded files if any
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await processUploadedFile(req, file);
        imageUrls.push(fileUrl);
      }
    }

    // Also support images passed in body (URLs)
    if (images) {
      const parsedImages = safeParseArray(images, []);
      if (Array.isArray(parsedImages) && parsedImages.length > 0) {
        imageUrls = [...imageUrls, ...parsedImages];
      }
    }

    // Default image if none provided
    if (imageUrls.length === 0) {
      imageUrls = [
        'https://i.pinimg.com/736x/3b/f7/73/3bf773a3ef0c40967742270bba69b7c2.jpg',
      ];
    }

    // Parse sizes and colors safely
    const parsedSizes = safeParseArray(sizes, ['7', '8', '9', '10', '11']);
    const parsedColors = safeParseArray(colors, ['Black', 'White']);

    const product = new Product({
      name,
      slug,
      brand: brand || 'Volant',
      category,
      gender: gender || 'Men',
      description: finalDescription,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      images: imageUrls,
      sizes: parsedSizes,
      colors: parsedColors,
      stock: Number(stock) || 0,
      sku,
      isFeatured: isFeatured === true || isFeatured === 'true',
      isActive: isActive === undefined ? true : isActive === true || isActive === 'true',
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully in MongoDB Atlas',
      product: savedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a footwear product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    let {
      name,
      slug,
      brand,
      category,
      gender,
      description,
      price,
      discountPrice,
      images,
      sizes,
      colors,
      stock,
      sku,
      isFeatured,
      isActive,
    } = req.body;

    if (name) product.name = name;
    if (brand) product.brand = brand;
    if (category) product.category = normalizeCategory(category);
    if (gender) product.gender = gender;
    if (description) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (discountPrice !== undefined) {
      product.discountPrice = discountPrice ? Number(discountPrice) : null;
    }
    if (stock !== undefined) product.stock = Number(stock);
    if (sku) product.sku = sku.toUpperCase().trim();
    if (isFeatured !== undefined) {
      product.isFeatured = isFeatured === true || isFeatured === 'true';
    }
    if (isActive !== undefined) {
      product.isActive = isActive === true || isActive === 'true';
    }

    // Slug update
    if (slug && slug !== product.slug) {
      const sanitizedSlug = slugify(slug, { lower: true, strict: true });
      const duplicateSlug = await Product.findOne({
        slug: sanitizedSlug,
        _id: { $ne: product._id },
      });
      if (duplicateSlug) {
        product.slug = `${sanitizedSlug}-${Date.now().toString().slice(-4)}`;
      } else {
        product.slug = sanitizedSlug;
      }
    }

    // Sizes & Colors
    if (sizes !== undefined) {
      product.sizes = safeParseArray(sizes, product.sizes || ['7', '8', '9', '10', '11']);
    }
    if (colors !== undefined) {
      product.colors = safeParseArray(colors, product.colors || ['Black', 'White']);
    }

    // Process new uploaded images
    let newImageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = await processUploadedFile(req, file);
        newImageUrls.push(fileUrl);
      }
    }

    if (images !== undefined) {
      const parsedImages = safeParseArray(images, []);
      if (Array.isArray(parsedImages)) {
        product.images = [...parsedImages, ...newImageUrls];
      }
    } else if (newImageUrls.length > 0) {
      product.images = [...product.images, ...newImageUrls];
    }

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully in MongoDB Atlas',
      product: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a footwear product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Clean up stored image in MongoDB Atlas if any
    if (product.images && product.images.length > 0) {
      for (const imgUrl of product.images) {
        if (typeof imgUrl === 'string') {
          const parts = imgUrl.split('/');
          const filename = parts[parts.length - 1];
          if (filename && filename.startsWith('footwear-')) {
            await Image.findOneAndDelete({ filename }).catch(() => {});
          }
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: `Product "${product.name}" deleted successfully from database`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle product active or featured status
// @route   PATCH /api/admin/products/:id/toggle
// @access  Private/Admin
const toggleProductStatus = async (req, res, next) => {
  try {
    const { field } = req.body; // 'isActive' or 'isFeatured'
    if (!['isActive', 'isFeatured'].includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field to toggle. Must be isActive or isFeatured.',
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    product[field] = !product[field];
    await product.save();

    res.status(200).json({
      success: true,
      message: `${field} updated to ${product[field]}`,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Standalone Image upload endpoint
// @route   POST /api/admin/upload
// @access  Private/Admin
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
    }

    const fileUrl = await processUploadedFile(req, req.file);

    res.status(200).json({
      success: true,
      url: fileUrl,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  uploadImage,
};
