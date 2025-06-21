const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const categorySchema = new mongoose.Schema(
  {
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
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
      },
    ],
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

// Pre-save middleware to generate slug from name
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

//check if slug is unique
categorySchema.pre("save", async function (next) {
  const existingCategory = await this.constructor.findOne({ slug: this.slug });
  if (
    existingCategory &&
    existingCategory._id.toString() !== this._id.toString()
  ) {
    console.log(
      `Category with slug ${this.slug} or ${this.name} already exists`
    );

    throw new customError(
      `Category with slug ${this.slug} or ${this.name} already exists`,
      400
    );
  }
  next();
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
