const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { updateProductInfoBySlug } = require("../controller/product.controller");

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: false,
      min: 0,
      max: 5,
    },
    comment: {
      type: String,
      required: false,
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    // Basic Product Info
    // Slug
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: false,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: false,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },
    variant: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
        default: null,
      },
    ],
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
      default: null,
    },

    image: [
      {
        type: String,
      },
    ],
    tag: [
      {
        type: String,
        trim: true,
      },
    ],
    manufactureCountry: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
    },
    warrantyInformation: {
      type: String,
      required: false,
      default: "No warranty info",
    },
    shippingInformation: {
      type: String,
      default: "Shipping details not available",
    },
    availabilityStatus: {
      type: String,
      enum: ["In Stock", "Out of Stock", "Preorder"],
      default: "In Stock",
    },
    reviews: [reviewSchema],
    // stock key unit
    sku: {
      type: String,
      trim: true,
    },

    //bar code
    qrCode: {
      type: String,
    },
    barCode: {
      type: String,
    },

    // group unit
    groupUnit: {
      type: String,
    },
    groupUnitQuantity: {
      type: Number,
    },
    unit: {
      type: String,
      enum: ["Piece", "Kg", "Gram", "Packet", "Custom"],
    },
    // Variant Type
    variantType: {
      type: String,
      enum: ["singleVariant", "multipleVariant"],
    },

    // Inventory & Price for Single Variant
    size: [
      {
        type: String,
        trim: true,
        // enum: ["S", "M", "L", "XL", "XXL", "XXXL", "Custom", "N/A"],
        default: "N/A",
      },
    ],
    color: [
      {
        type: String,
        trim: true,
        default: "N/A",
      },
    ],

    stock: {
      type: Number,
      min: 0,
    },
    warehouseLocation: {
      type: String,
      trim: true,
    },

    // Pricing
    purchasePrice: {
      type: Number,
      min: 0,
    },
    retailPrice: {
      type: Number,
      min: 0,
    },
    retailProfitMarginbyPercentance: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    retailProfitMarginbyAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    wholesalePrice: {
      type: Number,
      min: 0,
    },
    wholesaleProfitMarginPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    wholesaleProfitMarginAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    alertQuantity: {
      type: Number,
      default: 5,
    },
    stockAlert: {
      type: Boolean,
      default: false,
    },
    instock: {
      type: Boolean,
    },
    stockAdjustment: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StockAdjust",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug from name
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// when changing prouct name then change the slug using findoneandupdate
productSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

// Ensure unique slug
productSchema.pre("save", async function (next) {
  const existingProduct = await this.constructor.findOne({ slug: this.slug });
  if (
    existingProduct &&
    existingProduct._id.toString() !== this._id.toString()
  ) {
    throw new customError(
      `Product with slug ${this.slug} or ${this.name} already exists`,
      400
    );
  }
  next();
});

// virtual populate for variants
productSchema.virtual("allSize").get(function () {
  const standardSizes = ["S", "M", "L", "XL", "XXL", "XXXL"];

  return standardSizes;
});

productSchema.virtual("allNummerixSize").get(function () {
  return [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 38, 40, 42, 44, 46];
});

productSchema.virtual("allOpeningStock").get(function () {
  return this.variant.reduce((total, variant) => {
    total += variant.stockVariant;
    return total;
  }, 0);
});

// adjustment plus
productSchema.virtual("adjustmentVariantplus").get(function () {
  const mal = this.variant.map((variant) => {
    return variant.stockVariantAdjust;
  });
  const variantPlus = mal.flat();
  const totalAdjustStockofVariant = variantPlus.reduce((total, variant) => {
    total += variant.increaseQuantity;
    return total;
  }, 0);
  return totalAdjustStockofVariant;
});

// adjustment minus
productSchema.virtual("adjustmentVariantminus").get(function () {
  const mal = this.variant.map((variant) => {
    return variant.stockVariantAdjust;
  });
  const variantPlus = mal.flat();
  const totalAdjustStockofVariant = variantPlus.reduce((total, variant) => {
    total += variant.decreaseQuantity;
    return total;
  }, 0);
  return totalAdjustStockofVariant;
});

productSchema.virtual("sizeWiseStock").get(function () {
  const result = {};

  // CASE 1: multipleVariant -> use variants
  if (this.variant && this.variant.length > 0) {
    this.variant.forEach((v) => {
      if (v.size) {
        result[v.size] = (result[v.size] || 0) + (v.stockVariant || 0);
      }
    });
    return result;
  }

  // CASE 2: singleVariant -> use product's own size + stock
  if (this.variantType === "singleVariant" && this.size && this.size.length) {
    this.size.forEach((s) => {
      result[s] = (result[s] || 0) + (this.stock || 0);
    });
    return result;
  }

  // CASE 3: no variants and not singleVariant
  return result;
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
