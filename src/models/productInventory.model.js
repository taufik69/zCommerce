const mongoose = require("mongoose");

const productInventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
    },
    stock: {
      type: Number,
      min: 0,
    },
    reverseStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    instock: {
      type: Boolean,
      default: true,
    },
    warehouseLocation: {
      type: String,
      trim: true,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    wholeSalePrice: {
      type: Number,
      min: 0,
    },
    profitRate: {
      type: Number,
      min: 0,
    },
    alertQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockAlert: {
      type: Boolean,
      default: false,
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

const ProductInventory = mongoose.model(
  "ProductInventory",
  productInventorySchema
);

module.exports = ProductInventory;
