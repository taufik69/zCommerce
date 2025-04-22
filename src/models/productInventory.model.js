const mongoose = require("mongoose");

const productInventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
    },
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
    },
    stock: {
      type: Number,
      required: true,
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
      required: true,
      min: 0,
    },
    wholeSalePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    profitRate: {
      type: Number,
      required: true,
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
