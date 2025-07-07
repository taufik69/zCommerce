const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

// @desc make a discount controller
const Discount = require("../models/discount.model");
const validateDiscount = require("../validation/discount.validation");

// @desc create a new discount
exports.createDiscount = asynchandeler(async (req, res) => {
  const value = await validateDiscount(req);

  // check if the discount already exists
  const existingDiscount = await Discount.findOne({ slug: value.slug });
  if (existingDiscount) {
    throw new customError("Discount with this slug already exists", 400);
  }

  // create a new discount
  const discount = new Discount(value);

  await discount.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Discount created successfully",
    discount
  );
});

// @desc get all discounts
exports.getAllDiscounts = asynchandeler(async (req, res) => {
  const discounts = await Discount.find();
  return apiResponse.sendSuccess(
    res,
    200,
    "Discounts fetched successfully",
    discounts
  );
});

// @desc search discount with the help of slug
exports.getDiscountBySlug = asynchandeler(async (req, res) => {
  const slug = req.params.slug;
  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount fetched successfully",
    discount
  );
});

// @desc update a discount by slug
exports.updateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const updates = req.body;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Update only the fields provided in the request body
  Object.keys(updates).forEach((key) => {
    discount[key] = updates[key];
  });

  // Save the updated discount to the database
  await discount.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount updated successfully",
    discount
  );
});

// @desc deactivate a discount by slug
exports.deactivateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: true });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Deactivate the discount
  discount.isActive = false;
  await discount.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount deactivated successfully",
    discount
  );
});

// @desc active discount  by slug
exports.activateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: false });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Activate the discount
  discount.isActive = true;
  await discount.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount activated successfully",
    discount
  );
});

// @desc  permanent delte the discount
exports.deleteDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the discount by slug
  const discount = await Discount.findOneAndDelete({ slug });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount deleted successfully",
    discount
  );
});
