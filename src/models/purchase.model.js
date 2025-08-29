const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },
    price: {
      type: Number,
    },
    stock: {
      type: Number,
      min: 0,
    },
    wholesalePrice: {
      type: Number,
    },
    retailPrice: {
      type: Number,
    },
    size: String,
    color: String,
  },
  { timestamps: true }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
