const { customError } = require("../lib/CustomError");
const mongoose = require("mongoose");
const { default: slugify } = require("slugify");

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
    this.slug = slugify(this.code, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
couponSchema.pre("save", async function (next) {
  const existingCoupon = await this.constructor.findOne({ slug: this.slug });
  if (existingCoupon && existingCoupon._id.toString() !== this._id.toString()) {
    console.log(
      `Coupon with slug ${this.slug} or code ${this.code} already exists`
    );
    throw new customError(
      `Coupon with slug ${this.slug} or code ${this.code} already exists`
    );
  }
  next();
});

module.exports = mongoose.model("Coupon", couponSchema);
