const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const Subcategory = require("../models/subcategory.model");
const Category = require("../models/category.model");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateSubCategory,
} = require("../validation/subCatgegory.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

// ─── constants ────────────────────────────────────────────────────────────────

const NS = "subcategory";
const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_TTL_SEARCH = 60 * 5; // 5 min — search results change faster

// ─── helpers ──────────────────────────────────────────────────────────────────

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  // Invalidate cache
  await bumpNsVersion(NS);
  await bumpNsVersion("category"); // Bump category too since subcategories array changed

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Subcategory created successfully",
    subcategory,
  );
});

// @desc    Get all subcategories
exports.getAllSubCategory = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Subcategories found", {
      subCategories: cached,
      fromCache: true,
    });
  }

  const subCategories = await Subcategory.find()
    .populate("category", {
      name: 1,
      slug: 1,
      isActive: 1,
    })
    .populate("discount")
    .sort({ createdAt: -1 })
    .lean();

  if (!subCategories.length) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "No subcategories found",
      {
        subCategories: [],
        fromCache: false,
      },
    );
  }

  await setCache(cacheKey, subCategories, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Subcategories found", {
    subCategories,
    fromCache: false,
  });
});

// @desc    Get a subcategory by slug
exports.getSubCategoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Subcategory found", {
      subCategories: cached,
      fromCache: true,
    });
  }

  const subCategory = await Subcategory.findOne({ slug })
    .populate("category", {
      name: 1,
      slug: 1,
      isActive: 1,
    })
    .lean();

  if (!subCategory) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Subcategory not found",
      {
        subCategories: [],
        fromCache: false,
      },
    );
  }

  await setCache(cacheKey, subCategory, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Subcategory found", {
    subCategories: subCategory,
    fromCache: false,
  });
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
    // Bump category cache since relations changed
    await bumpNsVersion("category");
  }

  // Save the updated subcategory to the database
  await subCategory.save();

  // Invalidate cache
  await bumpNsVersion(NS);

  // Send success response
  apiResponse.sendSuccess(res, statusCodes.OK, "Subcategory updated", {
    subCategories: subCategory,
    fromCache: false,
  });
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

  // Invalidate cache
  await bumpNsVersion(NS);
  await bumpNsVersion("category");

  // Send success response
  apiResponse.sendSuccess(res, statusCodes.OK, "Subcategory deleted", {
    subCategories: subCategory,
    fromCache: false,
  });
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

  // Invalidate cache
  await bumpNsVersion(NS);

  // send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory activated successfully",
    { subCategories: subCategory, fromCache: false },
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

  // Invalidate cache
  await bumpNsVersion(NS);

  // send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Subcategory deactivated successfully",
    { subCategories: subCategory, fromCache: false },
  );
});

// @desc    Get all inactive subcategories
exports.getInactiveSubCategories = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "inactive");
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Inactive subcategories found",
      { subCategories: cached, fromCache: true },
    );
  }

  const subCategories = await Subcategory.find({ isActive: false })
    .populate("category", { name: 1, slug: 1, isActive: 1 })
    .lean();

  if (!subCategories) {
    throw new customError(
      "Inactive subcategories not found",
      statusCodes.NOT_FOUND,
    );
  }

  await setCache(cacheKey, subCategories, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Inactive subcategories found", {
    subCategories,
    fromCache: false,
  });
});
// @desc    Get all active subcategories
exports.getActiveSubCategories = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "active");
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Active subcategories found",
      { subCategories: cached, fromCache: true },
    );
  }

  const subCategories = await Subcategory.find({ isActive: true })
    .populate("category", { name: 1, slug: 1, isActive: 1 })
    .lean();

  if (!subCategories) {
    throw new customError(
      "Active subcategories not found",
      statusCodes.NOT_FOUND,
    );
  }

  await setCache(cacheKey, subCategories, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Active subcategories found", {
    subCategories,
    fromCache: false,
  });
});

// @desc    Search subcategories by name (case-insensitive regex)
exports.searchSubCategories = asynchandeler(async (req, res) => {
  const search = String(req.query.search || "").trim();

  if (!search) {
    throw new customError("Search query is required", statusCodes.BAD_REQUEST);
  }

  const cacheKey = await buildCacheKey(NS, `search:${search.toLowerCase()}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Subcategories found", {
      subCategories: cached,
      fromCache: true,
    });
  }

  const safeSearch = escapeRegex(search);

  const subCategories = await Subcategory.find({
    name: { $regex: safeSearch, $options: "i" },
  })
    .populate("category", { name: 1, slug: 1, isActive: 1 })
    .sort({ createdAt: -1 })
    .lean();

  if (!subCategories.length) {
    throw new customError("No subcategories found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, subCategories, CACHE_TTL_SEARCH);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Subcategories found", {
    subCategories,
    fromCache: false,
  });
});
