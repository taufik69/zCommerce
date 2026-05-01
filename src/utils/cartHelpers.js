const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");

exports.getSnapshotPrice = async (productId, variantId) => {
  if (variantId) {
    const variant = await Variant.findById(variantId).populate("product");
    if (!variant || !variant.isActive) {
      throw new customError("Variant not found or inactive", 404);
    }
    // Also check if parent product is active
    if (variant.product && !variant.product.isActive) {
      throw new customError("Parent product is inactive", 400);
    }
    
    // We prioritize variant retailPrice
    const snapshotPrice = variant.retailPrice || 0;
    // stockVariant might be modified by adjustments but we use stockVariant as base
    const stock = variant.stockVariant || 0; 
    
    return { snapshotPrice, stock };
  } else {
    if (!productId) {
      throw new customError("Product ID is required", 400);
    }
    
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new customError("Product not found or inactive", 404);
    }
    
    const snapshotPrice = product.retailPrice || 0;
    const stock = product.stock || 0;
    
    return { snapshotPrice, stock };
  }
};
