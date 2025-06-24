const { apiResponse } = require("../utils/apiResponse");
const Category = require("../models/category.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCategory } = require("../validation/category.validation");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");

// @desc    Create a new category

exports.createCategory = asynchandeler(async (req, res) => {
  const value = await validateCategory(req);
  const { name } = value;
  // upload the image into cloudinary
  const { optimizeUrl } = await cloudinaryFileUpload(req.files[0].path);
  // now save the category to the database
  const category = new Category({
    name: name,
    image: optimizeUrl,
  });
  await category.save();
  // send success response
  apiResponse.sendSuccess(res, 201, "Category created successfully", category);
});

// @desc    Get all categories
exports.getAllCategories = asynchandeler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .populate({
      path: "subcategories",
      select: "-updatedAt -createdAt",
    })
    .select("-updatedAt -createdAt");
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});

// @desc    Get a single category by slug
exports.getCategoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug, isActive: true })
    .populate({
      path: "subcategories",
      select: "-updatedAt -createdAt",
    })
    .select("-updatedAt -createdAt");

  if (!category) {
    throw new customError("Category not found", 404);
  }
  // send success response
  apiResponse.sendSuccess(res, 200, "Category fetched successfully", {
    category,
  });
});

// @desc    Update a category by slug
exports.updateCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    throw new customError("Category not found", 404);
  }
  let optimizeUrlCloudinary = null;
  // upload the image into cloudinary
  if (req?.files?.length) {
    // delete the old image from cloudinary
    const imageUrl = category.image;
    // Regex to extract the ID
    const regex = /\/([a-zA-Z0-9_-]+)\?/;

    // Match the regex and extract the ID
    const match = imageUrl.match(regex);
    const publicId = match ? match[1] : null;

    if (!publicId) {
      throw new customError("Invalid image URL", 400);
    }
    await deleteCloudinaryFile(publicId);
    // upload the new image into cloudinary
    const { optimizeUrl } = await cloudinaryFileUpload(req.files[0].path);
    optimizeUrlCloudinary = optimizeUrl;
  }

  // now update the category to the database
  category.name = req.body.name || category.name;
  category.image = optimizeUrlCloudinary || category.image;
  await category.save();
  // send success response
  apiResponse.sendSuccess(res, 200, "Category updated successfully", {
    category,
  });
});

// @desc    Delete a category by slug
exports.deleteCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the category by slug and ensure it is active
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    throw new customError("Category not found", 404);
  }

  // Delete the old image from Cloudinary
  const imageUrl = category.image;
  const regex = /\/([a-zA-Z0-9_-]+)\?/; // Regex to extract the ID
  const match = imageUrl.match(regex);
  const publicId = match ? match[1] : null;

  if (!publicId) {
    throw new customError("Invalid image URL", 400);
  }

  // Delete the image from Cloudinary
  await deleteCloudinaryFile(publicId);

  // Delete the category document from the database
  await Category.findOneAndDelete({ slug, isActive: true });

  // Send success response
  apiResponse.sendSuccess(res, 200, "Category deleted successfully", {
    slug,
  });
});

// @desc activate a category by slug
exports.activateCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug, isActive: false });
  if (!category) {
    throw new customError("Category not found", 404);
  }
  // now activate the category in the database
  category.isActive = true;
  await category.save();
  // send success response
  apiResponse.sendSuccess(res, 200, "Category activated successfully", {
    category,
  });
});
// @desc deactivate a category by slug
exports.deactivateCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    throw new customError("Category not found", 404);
  }
  // now deactivate the category in the database
  category.isActive = false;
  await category.save();
  // send success response
  apiResponse.sendSuccess(res, 200, "Category deactivated successfully", {
    category,
  });
});
// @desc get all active categories
exports.getActiveCategories = asynchandeler(async (req, res) => {
  const categories = await Category.find({ isActive: true });
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});
// @desc get all inactive categories
exports.getInactiveCategories = asynchandeler(async (req, res) => {
  const categories = await Category.find({ isActive: false });
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});

// @desc get all categories with search
exports.getCategoriesWithSearch = asynchandeler(async (req, res) => {
  const { search } = req.query;
  const categories = await Category.find({
    name: { $regex: search, $options: "i" },
    isActive: true,
  });
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});
// @desc get all categories with sort
exports.getCategoriesWithSort = asynchandeler(async (req, res) => {
  const { sort } = req.query;
  const categories = await Category.find({ isActive: true }).sort(sort);
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});
