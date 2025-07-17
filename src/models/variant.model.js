const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
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
      trim: true,
      enum: ["S", "M", "L", "XL", "XXL", "XXXL", "Custom", "N/A"],
      default: "N/A",
    },
    color: {
      type: String,
      trim: true,
      default: "N/A",
    },
    // Quantity / stock
    stockVariant: {
      type: Number,
      required: true,
      min: 0,
    },
    alertVariantStock: {
      type: Number,
      min: 0,
      default: 5,
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

// slugify
variantSchema.pre("save", function (next) {
  if (this.isModified("variantName")) {
    this.slug = slugify(this.variantName, { lower: true, strict: true });
  }
  next();
});

// virtuals
variantSchema.virtual("retailProfitAmount").get(function () {
  return (this.retailPrice * this.retailProfitMargin) / 100;
});
variantSchema.virtual("wholesaleProfitAmount").get(function () {
  return (this.wholesalePrice * this.wholesaleProfitMargin) / 100;
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
// after variant save then update product model variant array
variantSchema.post("save", async function (doc) {
  if (this.isNew) {
    const Product = require("./product.model");
    const result = await Product.findOne({ _id: doc.product });
    console.log(result); // For debugging
    // Remove the return statement!
    if (result) {
      result.variant.push(doc._id);
      await result.save();
    } else {
      throw new customError("Product not found", 404);
    }
  } else if (this.isModified("variantName")) {
    const Product = require("./product.model");
    const result = await Product.findOne({ _id: doc.product });
    console.log(result); // For debugging
  }
});
// after variant delete then remove from product model variant array
variantSchema.post("remove", async function (doc) {
  const Product = require("./product.model");
  await Product.findByIdAndUpdate(doc.product, {
    $pull: { variant: doc._id },
  });
});

module.exports = mongoose.model("Variant", variantSchema);
