const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const Subcategory = require("../models/subcategory.model");
const Category = require("..//models/category.model");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateSubCategory,
} = require("../validation/subCatgegory.validation");

// @desc    Create a new subcategory
exports.createSubCategories = asynchandeler(async (req, res) => {
  const subcategoriesData = req.body; // Expecting an array of { name, category }

  if (!Array.isArray(subcategoriesData) || subcategoriesData.length === 0) {
    throw new customError("At least one subcategory is required", 400);
  }

  let savedSubcategories = [];

  for (let i = 0; i < subcategoriesData.length; i++) {
    const { name, category } = subcategoriesData[i];

    if (!name || !category) {
      throw new customError(
        `Subcategory name and category are required at index ${i}`,
        400
      );
    }

    // Validate category exists
    const parentCategory = await Category.findById(category);
    if (!parentCategory) {
      throw new customError(`Category not found for index ${i}`, 404);
    }

    // Create subcategory
    const subcategory = new Subcategory({
      name,
      category,
    });

    await subcategory.save();

    // Add subcategory to parent category
    parentCategory.subcategories.push(subcategory._id);
    await parentCategory.save();

    savedSubcategories.push(subcategory);
  }

  apiResponse.sendSuccess(
    res,
    201,
    "Subcategories created successfully",
    savedSubcategories
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
    throw new customError("Subcategories not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Subcategories found", subCategories);
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
    throw new customError("Subcategory not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Subcategory found", subCategory);
});

// @desc    Update a subcategory by slug
exports.updateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the subcategory by slug
  const subCategory = await Subcategory.findOne({ slug });
  if (!subCategory) {
    throw new customError("Subcategory not found", 404);
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
  apiResponse.sendSuccess(res, 200, "Subcategory updated", subCategory);
});

// @desc    Delete a subcategory by slug
exports.deleteSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the subcategory by slug
  const subCategory = await Subcategory.findOne({ slug });
  if (!subCategory) {
    throw new customError("Subcategory not found", 404);
  }

  // Delete the subcategory
  await Subcategory.deleteOne({ _id: subCategory._id });

  // Remove subcategory from category's subcategories array
  await Category.findByIdAndUpdate(subCategory.category, {
    $pull: { subcategories: subCategory._id },
  });

  // Send success response
  apiResponse.sendSuccess(res, 200, "Subcategory deleted", subCategory);
});

// @desc    Activate a subcategory by slug
exports.activateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const subCategory = await Subcategory.findOne({ slug, isActive: false });
  if (!subCategory) {
    throw new customError("Subcategory not found", 404);
  }
  // now activate the subcategory in the database
  subCategory.isActive = true;
  await subCategory.save();
  // send success response
  apiResponse.sendSuccess(res, 200, "Subcategory activated successfully", {
    subCategory,
  });
});

// @desc    Deactivate a subcategory by slug
exports.deactivateSubCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const subCategory = await Subcategory.findOne({ slug, isActive: true });
  if (!subCategory) {
    throw new customError("Subcategory not found", 404);
  }
  // now deactivate the subcategory in the database
  subCategory.isActive = false;
  await subCategory.save();
  // send success response
  apiResponse.sendSuccess(res, 200, "Subcategory deactivated successfully", {
    subCategory,
  });
});

// @desc    Get all inactive subcategories
exports.getInactiveSubCategories = asynchandeler(async (req, res) => {
  const subCategories = await Subcategory.find({ isActive: false }).populate(
    "category",
    { name: 1, slug: 1, isActive: 1 }
  );
  if (!subCategories) {
    throw new customError("Inactive subcategories not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Inactive subcategories found",
    subCategories
  );
});
// @desc    Get all active subcategories
exports.getActiveSubCategories = asynchandeler(async (req, res) => {
  const subCategories = await Subcategory.find({ isActive: true }).populate(
    "category",
    { name: 1, slug: 1, isActive: 1 }
  );
  if (!subCategories) {
    throw new customError("Active subcategories not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Active subcategories found",
    subCategories
  );
});
