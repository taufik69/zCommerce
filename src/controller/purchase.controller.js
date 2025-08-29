const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { apiResponse } = require("../utils/apiResponse");
const Purchase = require("../models/purchase.model");

//@desc Create a new purchase
//@route POST /api/purchase

exports.createPurchase = asynchandeler(async (req, res) => {
  const {
    product,
    variant,
    price,
    stock,
    wholesalePrice,
    retailPrice,
    size,
    color,
  } = req.body;

  //   validate req.body data
  if (!product && !variant) {
    throw new customError("Product or Variant is required", 400);
  }
  const purchase = await Purchase.create({
    product: product || null,
    variant: variant || null,
    price,
    stock,
    wholesalePrice,
    retailPrice,
    size,
    color,
  });

  if (!purchase) {
    throw new customError("Failed to create purchase", 500);
  }

  //   if product id ave en update e product info
  if (product) {
    const productinfo = await Product.findById(product);
    productinfo.stock = stock;
    productinfo.wholesalePrice = wholesalePrice;
    productinfo.retailPrice = retailPrice;
    productinfo.price = price;
    productinfo.size = Array.from(new Set([...productinfo.size, size]));
    productinfo.color = Array.from(new Set([...productinfo.color, color]));
    await productinfo.save();
  }

  if (variant) {
    const variantinfo = await Variant.findById(variant);
    if (!variantinfo) throw new customError("Failed to update variant", 404);
    variantinfo.stockVariant = stock;
    variantinfo.wholesalePrice = wholesalePrice;
    variantinfo.retailPrice = retailPrice;
    variantinfo.price = price;
    variantinfo.size = Array.from(new Set([...variantinfo.size, size]));
    variantinfo.color = Array.from(new Set([...variantinfo.color, color]));
    await variantinfo.save();
  }

  apiResponse.sendSuccess(res, 201, "Purchase created successfully", purchase);
});

// @desc get all purchases
// @route GET /api/purchase
// @access Private
exports.getAllPurchases = asynchandeler(async (req, res) => {
  const purchases = await Purchase.find()
    .populate("product")
    .populate("variant");
  if (!purchases || purchases.length === 0) {
    throw new customError("No purchases found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Purchases retrieved successfully",
    purchases
  );
});

/// @desc get single purchase using slug
// @route GET /api/purchase/:slug
// @access Private
exports.getSinglePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("ID is required", 400);
  }
  const purchase = await Purchase.findById(id)
    .populate("product")
    .populate("variant");
  if (!purchase) {
    throw new customError("Purchase not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Purchase retrieved successfully",
    purchase
  );
});

//@desc Delete a purchase
//@route DELETE /api/purchase/:id
//@access Private
exports.deletePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("ID is required", 400);
  }
  const purchase = await Purchase.findByIdAndDelete(id);
  if (!purchase) {
    throw new customError("Purchase not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Purchase deleted successfully", purchase);
});
