const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const Subcategory = require("../models/subcategory.model");
const Category = require("..//models/category.model");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateSubCategory,
} = require("../validation/subCatgegory.validation");
const { statusCodes } = require("../constant/constant");

// @desc    Create a new subcategory
exports.createSubCategory = asynchandeler(async (req, res) => {
  const { name, category } = req.body;

  //  Validation
  if (!name || !category) {
    throw new customError(
      "Subcategory name and category are required",
      statusCodes.BAD_REQUEST,
    );
  }

  // Check category exists
  const parentCategory = await Category.findById(category);
  if (!parentCategory) {
    throw new customError("Parent category not found", statusCodes.NOT_FOUND);
  }

  // Create subcategory
  const subcategory = await Subcategory.create({
    name,
    category,
  });

  // Push subcategory reference to parent category
  parentCategory.subcategories.push(subcategory._id);
  await parentCategory.save();

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Subcategory created successfully",
    subcategory,
  );
});

// @desc    Get all subcategories
exports.getAllSubCategory = asynchandeler(async (req, res) => {
  const subCategories = await Subcategory.find()
    .populate("category", {
      name: 1,
      slug: 1,
      isActive: 1,
    })
    .populate("discount")
    .sort({ createdAt: -1 });
  if (!subCategories) {
    throw new customError("Subcategories not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategories found",
    subCategories,
  );
});

// @desc    Get a subcategory by slug
exports.getSubCategoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const subCategory = await Subcategory.findOne({ slug }).populate("category", {
    name: 1,
    slug: 1,
    isActive: 1,
  });
  if (!subCategory) {
    throw new customError("Subcategory not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory found",
    subCategory,
  );
});

// @desc    Update a subcategory by slug
exports.updateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the subcategory by slug
  const subCategory = await Subcategory.findOne({ slug });
  if (!subCategory) {
    throw new customError("Subcategory not found", statusCodes.NOT_FOUND);
  }

  const oldCategoryId = subCategory.category.toString();
  const newCategoryId = req.body.category;

  // Update only the fields provided in the request body
  subCategory.name = req.body.name || subCategory.name;
  subCategory.category = newCategoryId || subCategory.category;

  // If category is changed, update the Category model
  if (newCategoryId && newCategoryId !== oldCategoryId) {
    // Remove subcategory from old category
    await Category.findByIdAndUpdate(oldCategoryId, {
      $pull: { subcategories: subCategory._id },
    });
    // Add subcategory to new category
    await Category.findByIdAndUpdate(newCategoryId, {
      $addToSet: { subcategories: subCategory._id },
    });
  }

  // Save the updated subcategory to the database
  await subCategory.save();

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory updated",
    subCategory,
  );
});

// @desc    Delete a subcategory by slug
exports.deleteSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the subcategory by slug
  const subCategory = await Subcategory.findOne({ slug });
  if (!subCategory) {
    throw new customError("Subcategory not found", statusCodes.NOT_FOUND);
  }

  // Delete the subcategory
  await Subcategory.deleteOne({ _id: subCategory._id });

  // Remove subcategory from category's subcategories array
  await Category.findByIdAndUpdate(subCategory.category, {
    $pull: { subcategories: subCategory._id },
  });

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory deleted",
    subCategory,
  );
});

// @desc    Activate a subcategory by slug
exports.activateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const subCategory = await Subcategory.findOne({
    slug: slug,
  });

  if (!subCategory) {
    throw new customError("Subcategory not found", statusCodes.NOT_FOUND);
  }
  // now activate the subcategory in the database
  subCategory.isActive = true;
  await subCategory.save();
  // send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory activated successfully",
    {
      subCategory,
    },
  );
});

// @desc    Deactivate a subcategory by slug
exports.deactivateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const subCategory = await Subcategory.findOne({ slug });
  if (!subCategory) {
    throw new customError("Subcategory not found", statusCodes.NOT_FOUND);
  }
  // now deactivate the subcategory in the database
  subCategory.isActive = false;
  await subCategory.save();
  // send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory deactivated successfully",
    {
      subCategory,
    },
  );
});

// @desc    Get all inactive subcategories
exports.getInactiveSubCategories = asynchandeler(async (req, res) => {
  const subCategories = await Subcategory.find({ isActive: false }).populate(
    "category",
    { name: 1, slug: 1, isActive: 1 },
  );
  if (!subCategories) {
    throw new customError(
      "Inactive subcategories not found",
      statusCodes.NOT_FOUND,
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Inactive subcategories found",
    subCategories,
  );
});
// @desc    Get all active subcategories
exports.getActiveSubCategories = asynchandeler(async (req, res) => {
  const subCategories = await Subcategory.find({ isActive: true }).populate(
    "category",
    { name: 1, slug: 1, isActive: 1 },
  );
  if (!subCategories) {
    throw new customError(
      "Active subcategories not found",
      statusCodes.NOT_FOUND,
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Active subcategories found",
    subCategories,
  );
});
