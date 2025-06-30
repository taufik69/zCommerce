const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const slugify = require("slugify");

const variantSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
      enum: ["S", "M", "L", "XL", "XXL", "XXXL", "Custom"], // Example sizes, adjust as needed
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    stockVariant: {
      type: Number,
      required: true,
      min: 0,
    },
    retailPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    retailProfitMargin: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // Assuming profit margin is a percentage
      default: 0,
    },

    wholesalePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    wholesaleProfitMargin: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // Assuming profit margin is a percentage
      default: 0,
    },
    alertVariantStock: {
      type: Number,
      required: true,
      min: 5, // Initial stock when the variant is created
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Include virtuals in JSON output
    toObject: { virtuals: true }, // Include virtuals in object output
  }
);

// make a slug from variantName  using slugify
variantSchema.pre("save", function (next) {
  if (this.isModified("variantName")) {
    this.slug = slugify(this.variantName, { lower: true, strict: true });
  }
  next();
});

//  make a virtual field for retailProfitAmount amount
variantSchema.virtual("retailProfitAmount").get(function () {
  return (this.retailPrice * this.retailProfitMargin) / 100;
});

variantSchema.virtual("wholesaleProfitAmount").get(function () {
  return (this.wholesalePrice * this.wholesaleProfitMargin) / 100;
});

// check if variant exist with same size and color and also slug
variantSchema.pre("save", async function (next) {
  const isExistSizeColor = await this.constructor.find({
    size: this.size,
    color: this.color,
    slug: this.slug,
  });

  if (
    isExistSizeColor &&
    isExistSizeColor._id &&
    isExistSizeColor._id.toString() !== this._id.toString()
  ) {
    throw new customError(`Already Have this ${this.color} and ${this.size}`);
  }
  next();
});

const Variant = mongoose.model("Variant", variantSchema);

module.exports = Variant;
