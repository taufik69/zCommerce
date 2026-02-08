const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const StockAdjust = require("../models/stockadjust.model");
const { statusCodes } = require("../constant/constant");

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
    return new customError(
      "Please provide either productId or variantId",
      statusCodes.BAD_REQUEST,
    );
  }

  if (!adjustReason) {
    return new customError(
      "Please provide all required fields",
      statusCodes.BAD_REQUEST,
    );
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
    return new customError(
      "Failed to create stock adjustment",
      statusCodes.SERVER_ERROR,
    );
  }
  //   update product stock
  if (productId) {
    const product = await Product.findById(productId);
    if (!product) {
      return new customError("Product not found", statusCodes.NOT_FOUND);
    }
    product.stock += increaseQuantity - decreaseQuantity;
    product.stockAdjustment.push(stockAdjust._id);
    await product.save();
  }
  //    update variant stock
  if (variantId) {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return new customError("Variant not found", statusCodes.NOT_FOUND);
    }
    variant.stockVariant += increaseQuantity - decreaseQuantity;
    variant.stockVariantAdjust.push(stockAdjust._id);
    await variant.save();
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Stock adjustment created successfully",
    stockAdjust,
  );
});

// @des view all product latest stock
exports.getAllStockAdjusts = asynchandeler(async (req, res) => {
  const stockAdjusts = await StockAdjust.find()
    .populate({
      path: "productId",
      populate: {
        path: "variant category subcategory",
      },
      select:
        "-description -brand -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt ",
    })
    .populate({
      path: "variantId",
      populate: {
        path: "product",
        populate: "category subcategory",
        select:
          "-description -brand -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt",
      },
      select:
        "-retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt -retailProfitMarginbyPercentance ",
    })
    .sort({ createdAt: -1 });
  if (!stockAdjusts || stockAdjusts.length === 0) {
    throw new customError("Stock adjustments not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Stock adjustments retrieved successfully",
    stockAdjusts,
  );
});

// @desc get all product category wise

exports.getAllProductCategoryWise = asynchandeler(async (req, res) => {
  const { category } = req.params;
  if (!category)
    throw new customError("Category is required", statusCodes.BAD_REQUEST);
  const products = await Product.find({ category }).populate(
    "stockAdjustment category subcategory brand variant",
  );
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products retrieved successfully",
    products,
  );
});
exports.getAllProductSSubcategoryWise = asynchandeler(async (req, res) => {
  const { subcategory } = req.params;
  if (!subcategory)
    throw new customError("Subcategory is required", statusCodes.BAD_REQUEST);
  const products = await Product.find({ subcategory }).populate(
    "stockAdjustment category subcategory brand variant",
  );
  if (!products || products.length === 0)
    throw new customError("Products not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products retrieved successfully",
    products,
  );
});

// @desc get all variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const variants = await Variant.find()
    .populate("product")
    .select("-updatedAt")
    .sort({ createdAt: -1 });
  if (!variants)
    throw new customError("Variants not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variants fetched successfully",
    variants,
  );
});

//@desc  get all single varinat product
exports.getSingleVariant = asynchandeler(async (req, res) => {
  const singleVariant = await Product.findOne({ variantType: "singleVariant" });

  if (!singleVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant fetched successfully",
    singleVariant,
  );
});

//@desc delete stockadust by id  en delete en product stock decrease
exports.deleteStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError(
      "Stock adjustment ID is required",
      statusCodes.BAD_REQUEST,
    );

  const stockAdjust = await StockAdjust.findById(id);
  if (!stockAdjust)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  // Decrease product stock
  const { productId, variantId, decreaseQuantity, increaseQuantity } =
    stockAdjust;
  if (productId) {
    const product = await Product.findById(productId);
    if (!product) {
      return new customError("Product not found", statusCodes.NOT_FOUND);
    }

    product.stock -= decreaseQuantity || increaseQuantity;
    product.stockAdjustment.pull(stockAdjust._id);
    await product.save();
  }
  //    update variant stock
  if (variantId) {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return new customError("Variant not found", statusCodes.NOT_FOUND);
    }
    variant.stockVariant -= decreaseQuantity || increaseQuantity;
    variant.stockVariantAdjust.pull(stockAdjust._id);
    await variant.save();
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Stock adjustment deleted successfully",
    stockAdjust,
  );
});
