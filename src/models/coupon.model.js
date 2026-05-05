const mongoose = require("mongoose");
const slugify = require("slugify").default || require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const couponSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, trim: true, index: true },
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true, // always store uppercase, e.g. "SAVE20"
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value must be positive"],
    },

    // Optional constraints
    minOrderAmount: { type: Number, default: 0, min: 0 }, // minimum cart total to apply
    maxDiscountAmount: { type: Number, default: null }, // cap for percentage discounts

    couponStartAt: { type: Date, required: [true, "Start date is required"] },
    expireAt: { type: Date, required: [true, "Expiry date is required"] },

    usageLimit: { type: Number, default: null, min: 1 }, // null = unlimited
    usedCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },

    // Scope: apply to specific products/categories (optional)
    applicableProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    applicableSubCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    ],
    applicableBrands: [{ type: mongoose.Schema.Types.ObjectId, ref: "Brand" }],
    applicableVariants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
    ],
    applicableCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  },
);

// ── Slug generation ──────────────────────────────────────────────────────────
couponSchema.pre("save", function (next) {
  if (this.isModified("code")) {
    this.slug = slugify(this.code, { lower: true, strict: true, trim: true });
  }
  next();
});

// ── Validations ──────────────────────────────────────────────────────────────
couponSchema.pre("save", function (next) {
  // expireAt must be after couponStartAt
  if (this.expireAt <= this.couponStartAt) {
    return next(
      new customError(
        "Expiry date must be after start date",
        statusCodes.BAD_REQUEST,
      ),
    );
  }

  // percentage discount must be 1–100
  if (this.discountType === "percentage") {
    if (this.discountValue <= 0 || this.discountValue > 100) {
      return next(
        new customError(
          "Percentage discount must be between 1 and 100",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
  }

  next();
});

// ── Virtual: is this coupon currently usable? ────────────────────────────────
couponSchema.virtual("isUsable").get(function () {
  const now = new Date();
  const withinDateRange = now >= this.couponStartAt && now <= this.expireAt;
  const withinUsageLimit =
    this.usageLimit === null || this.usedCount < this.usageLimit;
  return this.isActive && withinDateRange && withinUsageLimit;
});

// ── Instance method: safe increment usedCount ────────────────────────────────
couponSchema.methods.incrementUsage = async function () {
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
    throw new customError(
      "Coupon usage limit reached",
      statusCodes.BAD_REQUEST,
    );
  }
  // atomic increment — safe for concurrent requests
  await this.constructor.updateOne(
    { _id: this._id, $expr: { $lt: ["$usedCount", "$usageLimit"] } }, // guard
    { $inc: { usedCount: 1 } },
  );
};

// ── Index for common queries ─────────────────────────────────────────────────
couponSchema.index({ expireAt: 1 });
couponSchema.index({ isActive: 1, expireAt: 1 });

module.exports =
  mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
