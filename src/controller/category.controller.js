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
  const { name } = req.body; // array of names
  const files = req.files; // array of images

  if (!Array.isArray(name) || name.length === 0) {
    throw new customError("At least one category name is required", 400);
  }

  if (!files || files.length === 0) {
    throw new customError("At least one category image is required", 400);
  }

  if (name.length !== files.length) {
    throw new customError("Each category must have an image", 400);
  }

  let savedCategories = [];

  for (let i = 0; i < name.length; i++) {
    const imageUpload = await cloudinaryFileUpload(files[i].path);

    const category = new Category({
      name: name[i],
      image: imageUpload.optimizeUrl,
    });

    await category.save();
    savedCategories.push(category);
  }

  apiResponse.sendSuccess(
    res,
    201,
    "Categories created successfully",
    savedCategories
  );
});

// @desc    Get all categories
exports.getAllCategories = asynchandeler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .populate({
      path: "subcategories",
      select: "-updatedAt -createdAt",
    })
    .populate("discount")
    .select("-updatedAt -createdAt")
    .sort({ createdAt: -1 });
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
    .populate("discount")
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

    // Match the regex and extract the ID
    const match = imageUrl.split("/");
    const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL

    if (!publicId) {
      throw new customError("Invalid image URL", 400);
    }
    await deleteCloudinaryFile(publicId.split("?")[0]);
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
  const match = imageUrl.split("/");
  const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL

  if (!publicId) {
    throw new customError("Invalid image URL", 400);
  }

  // Delete the image from Cloudinary
  await deleteCloudinaryFile(publicId.split("?")[0]);

  // Delete the category document from the database
  await Category.findOneAndDelete({ slug, isActive: true });

  // Send success response
  apiResponse.sendSuccess(res, 200, "Category deleted successfully", {
    slug,
    category,
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

//@desc pagination of category
exports.getCategoryPagination = asynchandeler(async (req, res) => {
  const { limit, page } = req.query;
  const skip = (page - 1) * limit;
  const categories = await Category.find()
    .skip(skip)
    .limit(limit)
    .sort({
      createdAt: -1,
    })
    .populate("subcategories discount");
  const total = await Category.countDocuments();
  const totalPages = Math.ceil(total / limit);
  // send success response
  apiResponse.sendSuccess(res, 200, "Categories fetched successfully", {
    categories,
    page,
    limit,
    total,
    totalPages,
  });
});
