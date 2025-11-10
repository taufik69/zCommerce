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
  const { name, image } = await validateCategory(req);

  const category = Category.create({
    name,
    image: null,
  });

  // ✅ Send response immediately (non-blocking)
  apiResponse.sendSuccess(res, 202, "Categories are being created ");

  // ✅ Handle upload & DB insert in background (fire and forget)
  (async () => {
    try {
      const { optimizeUrl } = await cloudinaryFileUpload(image.path);

      await Category.findByIdAndUpdate(category._id, { image: optimizeUrl });

      console.log("✅ Background Category Creation Completed:");
    } catch (error) {
      console.error("❌ Background category creation failed:", error.message);
    }
  })();
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

  // ✅ Step 1: Find the existing category
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    throw new customError("Category not found", 404);
  }

  // ✅ Step 2: Send immediate response (non-blocking)
  apiResponse.sendSuccess(res, 202, "Category update is successfully ");

  // ✅ Step 3: Handle background update (fire and forget)
  (async () => {
    try {
      let optimizeUrlCloudinary = null;

      // If new image provided
      if (req?.files?.length) {
        const imageUrl = category.image;

        // Extract Cloudinary public ID
        const match = imageUrl.split("/");
        const publicId = match[match.length - 1].split(".")[0];

        if (!publicId) {
          console.error(
            "⚠️ Invalid Cloudinary image URL for category:",
            category._id
          );
        } else {
          // ✅ Delete old image from Cloudinary
          await deleteCloudinaryFile(publicId.split("?")[0]);
        }

        // ✅ Upload new image to Cloudinary
        const { optimizeUrl } = await cloudinaryFileUpload(req.files[0].path);
        optimizeUrlCloudinary = optimizeUrl;
      }

      // ✅ Update fields in DB
      category.name = req.body.name || category.name;
      category.image = optimizeUrlCloudinary || category.image;
      await category.save();

      console.log("✅ Background category update completed:", category._id);
    } catch (error) {
      console.error("❌ Background category update failed:", error.message);
    }
  })();
});

// @desc    Delete a category by slug
exports.deleteCategory = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Step 1: Find the category
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) {
    throw new customError("Category not found", 404);
  }

  // ✅ Step 2: Send response immediately (non-blocking)
  apiResponse.sendSuccess(
    res,
    202,
    "Category deletion is being processed in the background",
    { slug }
  );

  // ✅ Step 3: Run deletion process in background
  (async () => {
    try {
      const imageUrl = category.image;

      // Extract Cloudinary public ID
      const match = imageUrl.split("/");
      const publicId = match[match.length - 1].split(".")[0];

      if (publicId) {
        // ✅ Delete image from Cloudinary
        await deleteCloudinaryFile(publicId.split("?")[0]);
        console.log(`🗑️ Cloudinary image deleted for category: ${slug}`);
      } else {
        console.warn(`⚠️ Invalid image URL for category: ${slug}`);
      }

      // ✅ Delete category document from DB
      await Category.findOneAndDelete({ slug, isActive: true });

      console.log(`✅ Background category deletion completed: ${slug}`);
    } catch (error) {
      console.error(
        `❌ Background deletion failed for ${slug}:`,
        error.message
      );
    }
  })();
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
