const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { string, number } = require("joi");

const reviewSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  reviewerName: {
    type: String,
    required: true,
  },
  reviewerEmail: {
    type: String,
  },
});

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
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
    variant: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
    },

    thumbnail: {
      type: String,
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
    },
    rating: {
      type: Number,
      default: 0,
    },
    warrantyInformation: {
      type: String,
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
      unique: true,
    },

    //bar code
    barcode: {
      type: Number,
    },
    qrcode: {
      type: String,
    },

    // group unit
    groupUnit: {
      type: String,
      enum: ["Box", "Packet", "Dozen", "Custom"],
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
      required: true,
    },

    // Inventory & Price for Single Variant

    stock: {
      type: Number,
      min: 0,
    },
    warehouseLocation: {
      type: String,
      trim: true,
    },

    // Pricing
    retailPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    retailProfitMargin: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    wholesalePrice: {
      type: Number,
      min: 0,
    },
    wholesaleProfitMargin: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    alertQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockAlert: {
      type: Boolean,
      default: false,
    },
    instock: {
      type: Boolean,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// auto-generate sku from product  name color and size
productSchema.pre("save", function (next) {
  if (!this.sku) {
    const namePrefix = this.name?.slice(0, 3).toUpperCase() || "NON";
    const colorPrefix = this.color?.slice(0, 2).toUpperCase() || "CL";
    const sizePrefix = this.size?.toString().toUpperCase() || "SZ";
    const timestamp = Date.now().toString().slice(-6);

    this.sku = `${namePrefix}-${colorPrefix}-${sizePrefix}-${timestamp}`;
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

//  Virtual Field: Retail Profit Amount
productSchema.virtual("retailProfitAmount").get(function () {
  if (!this.retailPrice || !this.retailProfitMargin) return 0;
  return (this.retailPrice * this.retailProfitMargin) / 100;
});

//  Virtual Field: Wholesale Profit Amount
productSchema.virtual("wholesaleProfitAmount").get(function () {
  if (!this.wholesalePrice || !this.wholesaleProfitMargin) return 0;
  return (this.wholesalePrice * this.wholesaleProfitMargin) / 100;
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
