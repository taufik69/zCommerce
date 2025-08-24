const mongoose = require("mongoose");
const { Schema } = mongoose;

const stockAdjustSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
  },
  variantId: {
    type: Schema.Types.ObjectId,
    ref: "Variant",
  },
  adjustReason: {
    type: String,
    required: true,
    trim: true,
  },
  increaseQuantity: {
    type: Number,
    default: 0,
  },
  decreaseQuantity: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.StockAdjust ||
  mongoose.model("StockAdjust", stockAdjustSchema);
