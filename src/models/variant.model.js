const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: false,
      trim: true,
    },

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
    size: [
      {
        type: String,
        trim: true,

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
    image: {
      type: String,
      trim: true,
      default: "N/A",
    },

    // Quantity / stock
    stockVariant: {
      type: Number,
      required: false,
      min: 0,
    },
    stockVariantAdjust: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StockAdjust",
      },
    ],
    alertVariantStock: {
      type: Number,
      min: 0,
      default: 5,
    },
    // Pricing
    purchasePrice: {
      type: Number,
      required: false,
      min: 0,
    },
    retailPrice: {
      type: Number,
      required: false,
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
    salesReturn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SalesReturn",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// slugify
variantSchema.pre("save", function (next) {
  if (this.isModified("variantName")) {
    this.slug = slugify(this.variantName, { lower: true, strict: true });
  }
  next();
});

// findOneAndUpdate then change the slug
variantSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.variantName) {
    update.slug = slugify(update.variantName, { lower: true, strict: true });
  }
  next();
});

// Check for duplicate variant by size, color, product
variantSchema.pre("save", async function (next) {
  const existing = await this.constructor.findOne({
    product: this.product,
    size: this.size,
    color: this.color,
    slug: this.slug,
  });

  if (existing && existing._id.toString() !== this._id.toString()) {
    throw new customError(
      `Variant with size ${this.size} and color ${this.color} already exists.`
    );
  }

  next();
});

module.exports = mongoose.model("Variant", variantSchema);
