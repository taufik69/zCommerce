const { customError } = require("../lib/CustomError");
const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { statusCodes } = require("../constant/constant");

const couponSchema = new mongoose.Schema({
  slug: { type: String, unique: true, trim: true },
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true },
  couponStartAt: { type: Date, required: true },
  expireAt: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  // Coupon can be applied to specific products, categories, or subcategories
});

// make a slug using code
couponSchema.pre("save", function (next) {
  if (this.isModified("code")) {
    this.slug = slugify(this.code, { lower: true, strict: true, trim: true });
  }
  next();
});

// check this slug already exist or not
couponSchema.pre("save", async function (next) {
  try {
    const existingCoupon = await this.constructor.findOne({ slug: this.slug });
    if (
      existingCoupon &&
      existingCoupon._id.toString() !== this._id.toString()
    ) {
      console.log(
        `Coupon with slug ${this.slug} or code ${this.code} already exists`,
      );
      return next(
        new customError(
          `Coupon with slug ${this.slug} or code ${this.code} already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
