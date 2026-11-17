const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to generate slug if missing
categorySchema.pre('validate', function (next) {
  if (!this.slug || !this.slug.trim()) {
    if (this.name) {
      this.slug = slugify(this.name, { lower: true, strict: true }) || `cat-${Date.now()}`;
    } else {
      this.slug = `cat-${Date.now()}`;
    }
  } else {
    this.slug = slugify(this.slug, { lower: true, strict: true }) || `cat-${Date.now()}`;
  }
  next();
});

// Indexes for fast querying
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
