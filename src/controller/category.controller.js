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
  const value = validateCategory(req);
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
  const categories = await Category.find({ isActive: true });
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
  });
});

// @desc    Get a single category by slug
exports.getCategoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug, isActive: true });
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
  if (req.files.length) {
    // delete the old image from cloudinary
    const publicId = category.image.split("/").pop().split(".")[0];
    console.log(category.image);
    return;

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
