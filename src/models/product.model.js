const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { updateProductInfoBySlug } = require("../controller/product.controller");

const reviewSchema = new mongoose.Schema(
  {
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
      required: true,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // toJSON: { virtuals: true },
    // toObject: { virtuals: true },
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

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
