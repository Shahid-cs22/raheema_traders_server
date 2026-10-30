const mongoose = require('mongoose');

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
      default: 'Kinetic',
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
          'Sneakers',
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
          return val === null || val === undefined || val < this.price;
        },
        message: 'Discount price must be less than the regular price',
      },
    },
    images: {
      type: [String],
      required: [true, 'At least one product image is required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'At least one image is required',
      },
    },
    sizes: {
      type: [String],
      default: ['5','6','7', '8', '9', '10', '11'],
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

// Indexes for high performance querying
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
