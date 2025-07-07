const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const discountSchema = new mongoose.Schema(
  {
    discountValidFrom: {
      type: Date,
      required: true,
    },
    discountValidTo: {
      type: Date,
      required: true,
    },
    discountName: {
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
    discountType: {
      type: String,
      enum: ["tk", "percentance"],
      required: true,
    },
    discountValueByAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountValueByPercentance: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPlan: {
      type: String,
      enum: ["flat", "category", "product"],
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

// make a slug
discountSchema.pre("save", function (next) {
  if (this.isModified("discountName")) {
    this.slug = slugify(this.discountName, { lower: true, strict: true });
  }
  next();
});

// check if slug already exist or not
discountSchema.pre("save", async function (next) {
  const existDiscount = await this.constructor.findOne({ slug: this.slug });
  if (
    existDiscount &&
    existDiscount._id &&
    existDiscount._id.toString() !== this._id.toString()
  ) {
    console.log(`${this.discountName} already exists Try another`);
    throw new customError(
      ` ${this.discountName} already exists Try another`,
      400
    );
  }
  next();
});

const Discount = mongoose.model("Discount", discountSchema);

module.exports = Discount;
