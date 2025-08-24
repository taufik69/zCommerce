const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const StockAdjust = require("../models/stockadjust.model");

//@desc create stock adjust
//@route POST /api/stock-adjust
//@access Private
exports.createStockAdjust = asynchandeler(async (req, res) => {
  const {
    variantId,
    productId,
    adjustReason,
    increaseQuantity,
    decreaseQuantity,
    date,
  } = req.body;

  if (!variantId && !productId) {
    return next(
      new customError("Please provide either productId or variantId", 400)
    );
  }

  if (!adjustReason) {
    return next(new customError("Please provide all required fields", 400));
  }

  const stockAdjust = await StockAdjust.create({
    productId: productId || null,
    variantId: variantId || null,
    adjustReason,
    increaseQuantity,
    decreaseQuantity,
    date,
  });
  if (!stockAdjust) {
    return next(new customError("Failed to create stock adjustment", 500));
  }
  //   update product stock
  if (productId) {
    const product = await Product.findById(productId);
    if (!product) {
      return next(new customError("Product not found", 404));
    }
    product.stock += increaseQuantity - decreaseQuantity;
    product.stockAdjustment.push(stockAdjust._id);
    await product.save();
  }
  //    update variant stock
  if (variantId) {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return next(new customError("Variant not found", 404));
    }
    variant.stockVariant += increaseQuantity - decreaseQuantity;
    variant.stockVariantAdjust.push(stockAdjust._id);
    await variant.save();
  }

  apiResponse.sendSuccess(
    res,
    201,
    "Stock adjustment created successfully",
    stockAdjust
  );
});

// @des view all product latest stock
exports.getAllStockAdjusts = asynchandeler(async (req, res) => {
  const stockAdjusts = await StockAdjust.find()
    .populate({
      path: "productId",
      populate: {
        path: "variant",
      },
      select:
        "-variant -description -category -subcategory -brand -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt -stockAdjustment",
    })
    .populate({
      path: "variantId",
      populate: {
        path: "product",
        select:
          "-variant -description -category -subcategory -brand -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt",
      },
      select:
        "-retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt -retailProfitMarginbyPercentance -stockAdjustment",
    })
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(
    res,
    200,
    "Stock adjustments retrieved successfully",
    stockAdjusts
  );
});

// @desc get all product category wise

exports.getAllProductCategoryWise = asynchandeler(async (req, res) => {
  const { category } = req.params;
  if (!category) throw new customError("Category is required", 400);
  const products = await Product.find({ category }).populate(
    "stockAdjustment category subcategory brand variant"
  );
  apiResponse.sendSuccess(
    res,
    200,
    "Products retrieved successfully",
    products
  );
});
exports.getAllProductSSubcategoryWise = asynchandeler(async (req, res) => {
  const { subcategory } = req.params;
  if (!subcategory) throw new customError("Subcategory is required", 400);
  const products = await Product.find({ subcategory }).populate(
    "stockAdjustment category subcategory brand variant"
  );
  apiResponse.sendSuccess(
    res,
    200,
    "Products retrieved successfully",
    products
  );
});
