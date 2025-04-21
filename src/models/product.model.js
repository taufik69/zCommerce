const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const productSchema = new mongoose.Schema(
  {
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
    discountId: {
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
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tag: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// make a slug from name  using slugify
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check if slug is unique
productSchema.pre("save", async function (next) {
  const existingProduct = await this.constructor.findOne({ slug: this.slug });
  if (
    existingProduct &&
    existingProduct._id.toString() !== this._id.toString()
  ) {
    console.log(
      `Product with slug ${this.slug} or ${this.name} already exists`
    );

    throw new customError(
      `Product with slug ${this.slug} or ${this.name} already exists`,
      400
    );
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
