const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const TransactionCategory = require("../models/transitionCategory.model");
const { statusCodes } = require("../constant/constant");

// add new transaction category
exports.addTransactionCategories = asynchandeler(async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new customError("Categories is required", statusCodes.BAD_REQUEST);
  }
  const results = [];

  for (const name of categories) {
    const category = new TransactionCategory({ name });
    try {
      await category.save();
      results.push(category);
    } catch (err) {
      console.log(err.message);
    }
  }

  apiResponse.sendSuccess(res, statusCodes.OK, "Categories added", results);
});

// get all transaction category
exports.getAllTransitionCategory = asynchandeler(async (req, res) => {
  const categories = await TransactionCategory.find().sort({ createdAt: -1 });
  if (!categories.length) {
    throw new customError("Categories not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Categories fetched successfully",
    {
      categories,
    },
  );
});

// get single transaction category
exports.getSingleTransitionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await TransactionCategory.findOne({ slug });
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category fetched successfully",
    category,
  );
});

// update transaction category
exports.updateTransactionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const { name } = req.body;
  const category = await TransactionCategory.findOneAndUpdate(
    { slug },
    { name },
    { new: true },
  );
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category updated successfully",
    category,
  );
});

// delte transaction category
exports.deleteTransactionCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await TransactionCategory.findOneAndDelete({ slug });
  if (!category) {
    throw new customError("Category not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Category deleted successfully",
    category,
  );
});
