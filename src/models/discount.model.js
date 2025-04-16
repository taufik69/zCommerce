const mongoose = require("mongoose");

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
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["tk", "percentacne"],
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
    targetCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    targetProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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

const Discount = mongoose.model("Discount", discountSchema);

module.exports = Discount;
