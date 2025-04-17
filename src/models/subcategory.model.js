const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const subcategorySchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
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

// Pre-save middleware to generate slug from name
subcategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check if slug is unique
subcategorySchema.pre("save", async function (next) {
  const existingSubcategory = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existingSubcategory &&
    existingSubcategory._id.toString() !== this._id.toString()
  ) {
    console.log(
      `Subcategory with slug ${this.slug} or ${this.name} already exists`
    );

    throw new customError(
      `Subcategory with slug ${this.slug} or ${this.name} already exists`,
      400
    );
  }
  next();
});

const Subcategory = mongoose.model("Subcategory", subcategorySchema);

module.exports = Subcategory;
