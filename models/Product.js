const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      default: 'Volant',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: {
        values: [
          "Men's Shoes",
          "Women's Shoes",
          'Sports Shoes',
          'Sandals',
          'Formal Shoes',
          'Sneakers',
          'Raincoat',
          'Raincoats',
          'Umbrella & Cap',
          'Umbrella',
          'Cap',
          'Belt & Wallet',
          'Belt',
          'Wallet',
          'Shoe Polish & Socks',
          'Shoe Polish',
          'Socks',
        ],
        message: '{VALUE} is not a valid footwear or accessory category',
      },
    },
    gender: {
      type: String,
      enum: ['Men', 'Women', 'Kids', 'Elders', 'Unisex'],
      default: 'Men',
    },
    description: {
      type: String,
      default: 'Premium authentic collection from Raheema Traders, Karungal.',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    discountPrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          if (val === null || val === undefined || val === '') return true;
          const numericVal = Number(val);
          if (isNaN(numericVal) || numericVal <= 0) return false;

          const refPrice =
            this.price !== undefined
              ? Number(this.price)
              : this._update && (this._update.price || this._update.$set?.price)
              ? Number(this._update.price || this._update.$set.price)
              : undefined;

          if (refPrice !== undefined && !isNaN(refPrice)) {
            return numericVal < refPrice;
          }
          return true;
        },
        message: 'Discount price must be a positive number and less than the regular price',
      },
    },
    images: {
      type: [String],
      required: [true, 'At least one product image is required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.filter((s) => typeof s === 'string' && s.trim().length > 0).length > 0;
        },
        message: 'At least one valid product image URL is required',
      },
    },
    sizes: {
      type: [String],
      default: ['5', '6', '7', '8', '9', '10', '11'],
    },
    colors: {
      type: [String],
      default: ['Black', 'White'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 18,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook for slug, sku, images, sizes & colors sanitization
productSchema.pre('validate', function (next) {
  // 1. Slug auto-generation & non-ASCII fallback
  if (!this.slug || !this.slug.trim()) {
    if (this.name) {
      const generated = slugify(this.name, { lower: true, strict: true });
      this.slug = generated || `footwear-${Date.now()}`;
    } else {
      this.slug = `footwear-${Date.now()}`;
    }
  } else {
    this.slug = slugify(this.slug, { lower: true, strict: true }) || `footwear-${Date.now()}`;
  }

  // 2. SKU auto-generation if absent
  if (!this.sku || !this.sku.trim()) {
    const brandCode = (this.brand || 'VOL').substring(0, 3).toUpperCase();
    const catCode = (this.category || 'SH').substring(0, 2).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.sku = `${brandCode}-${catCode}-${randomNum}`;
  } else {
    this.sku = this.sku.toUpperCase().trim();
  }

  // 3. Image array sanitization
  if (Array.isArray(this.images)) {
    this.images = this.images
      .filter((img) => typeof img === 'string' && img.trim().length > 0)
      .map((img) => img.trim());
    if (this.images.length === 0) {
      this.images = ['https://i.pinimg.com/736x/3b/f7/73/3bf773a3ef0c40967742270bba69b7c2.jpg'];
    }
  }

  // 4. Sizes & Colors sanitization
  if (Array.isArray(this.sizes)) {
    this.sizes = this.sizes
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());
    if (this.sizes.length === 0) {
      this.sizes = ['Standard'];
    }
  }

  if (Array.isArray(this.colors)) {
    this.colors = this.colors
      .filter((c) => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());
    if (this.colors.length === 0) {
      this.colors = ['Standard'];
    }
  }

  next();
});

// Indexes for high performance querying
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
