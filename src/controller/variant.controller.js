const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const validateVariant = require("../validation/variant.validation");

// @desc create  variant controller
exports.createVariant = asynchandeler(async (req, res, next) => {
  // Validate the request body
  const validatedData = await validateVariant(req);
  // Proceed with saving the variant
  const variantData = new variant(validatedData);
  await variantData.save();
  // after variant save
  if (!variantData) {
    throw new customError("Failed to create variant", 500);
  }
  // push the variant to the product's variants array
  const productData = await product.findById(variantData.product);
  if (!productData) {
    throw new customError("Product not found", 404);
  }
  productData.variant.push(variantData._id);
  await productData.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Variant created successfully",
    variantData
  );
});

// @desc get all  variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const variants = await variant
    .find()
    .populate("product")
    .select("-updatedAt");
  return apiResponse.sendSuccess(
    res,
    200,
    "Variants fetched successfully",
    variants
  );
});

// @desc get single variant
exports.getSingleVariant = asynchandeler(async (req, res, next) => {
  const slug = req.params.slug;
  const singleVariant = await variant
    .findOne({ slug })
    .populate("product")
    .select("-updatedAt");
  if (!singleVariant) {
    throw new customError("Variant not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Variant fetched successfully",
    singleVariant
  );
});

// @desc update variant using req.params
exports.updateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  // const validatedData = await validateVariant(req);
  const updatedVariant = await variant.findOneAndUpdate(
    { slug },
    { $set: req.body },
    { new: true }
  );
  if (!updatedVariant) {
    throw new customError("Variant not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Variant updated successfully",
    updatedVariant
  );
});

// @desc deactivateVariant variant
exports.deactivateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToDeactivate = await variant.findOne({ slug });
  if (!variantToDeactivate) {
    throw new customError("Variant not found", 404);
  }
  variantToDeactivate.isActive = false;
  await variantToDeactivate.save();
  return apiResponse.sendSuccess(
    res,
    200,
    "Variant deactivated successfully",
    variantToDeactivate
  );
});

// @desc activate Variant
exports.activateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToActivate = await variant.findOne({ slug });
  if (!variantToActivate) {
    throw new customError("Variant not found", 404);
  }
  variantToActivate.isActive = true;
  await variantToActivate.save();
  return apiResponse.sendSuccess(
    res,
    200,
    "Variant activated successfully",
    variantToActivate
  );
});

// @desc delete variant
exports.deleteVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const deletedVariant = await variant.findOneAndDelete({ slug });
  if (!deletedVariant) {
    throw new customError("Variant not found", 404);
  }
  // remve the variant from the product's variants array
  const productData = await product.findById(deletedVariant.product);
  if (!productData) {
    throw new customError("Product not found", 404);
  }
  productData.variant.pull(deletedVariant._id);
  await productData.save();
  return apiResponse.sendSuccess(
    res,
    200,
    "Variant deleted successfully",
    deletedVariant
  );
});
