const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
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

// Middleware to generate slug before saving using slugify
brandSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Middleware to check if slug is unique before saving
brandSchema.pre("save", async function (next) {
  const existingBrand = await this.constructor.findOne({ slug: this.slug });
  if (existingBrand && existingBrand._id.toString() !== this._id.toString()) {
    console.log(`Brand with slug ${this.slug} or ${this.name} already exists`);
    throw new customError(
      `Category with slug ${this.slug} or ${this.name} already exists`,
      400
    );
  }
  next();
});
const Brand = mongoose.model("Brand", brandSchema);

module.exports = Brand;

// export default mongoose.model("Brand", brandSchema);
