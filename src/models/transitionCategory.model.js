const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const transitionCategorySchema = new mongoose.Schema(
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// make a slug using name
transitionCategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
transitionCategorySchema.pre("save", async function (next) {
  const existingTransitionCategory = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existingTransitionCategory &&
    existingTransitionCategory._id &&
    existingTransitionCategory._id.toString() !== this._id.toString()
  ) {
    console.log(`${this.name} already exists Try another`);
    throw new customError(`${this.name} already exists Try another`, 400);
  }
  next();
});

// when update then make a slug using name
transitionCategorySchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.TransitionCategory ||
  mongoose.model("TransitionCategory", transitionCategorySchema);
