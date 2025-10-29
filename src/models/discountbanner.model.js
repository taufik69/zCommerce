const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const discountBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    headLine: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

//
// 🔹 Generate slug before saving
//
discountBannerSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

//
// 🔹 Check duplicate slug
//
discountBannerSchema.pre("save", async function (next) {
  const existingBanner = await this.constructor.findOne({ slug: this.slug });
  if (existingBanner && existingBanner._id.toString() !== this._id.toString()) {
    throw new customError(
      400,
      `Banner with slug "${this.slug}" or title "${this.title}" already exists`
    );
  }
  next();
});

//
// 🔹 Update slug when findOneAndUpdate
//
discountBannerSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.title) {
    update.slug = slugify(update.title, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.discountBanner ||
  mongoose.model("discountBanner", discountBannerSchema);
