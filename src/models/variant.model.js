const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    stockVariant: {
      type: Number,
      required: true,
      min: 0,
    },
    variantBasePrice: {
      type: Number,
      required: true,
      min: 0,
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

const Variant = mongoose.model("Variant", variantSchema);

module.exports = Variant;
