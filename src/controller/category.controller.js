const { apiResponse } = require("../utils/apiResponse");
const Category = require("../models/category.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCategory } = require("../validation/category.validation");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

// ─── constants ────────────────────────────────────────────────────────────────

const NS = "category";
const CACHE_TTL = 60 * 60; // 1 hour — general lists
const CACHE_TTL_SEARCH = 60 * 5; // 5 min — search results change faster

const ALLOWED_SORT_FIELDS = new Set(["name", "createdAt", "isActive"]);

// ─── helpers ──────────────────────────────────────────────────────────────────

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseSortParam = (sort) => {
  if (!sort || typeof sort !== "string") return { createdAt: -1 };
  const dir = sort.startsWith("-") ? -1 : 1;
  const field = sort.replace(/^-/, "");
  return ALLOWED_SORT_FIELDS.has(field) ? { [field]: dir } : { createdAt: -1 };
};

// ─── controller class ─────────────────────────────────────────────────────────

class CategoryController {
  // CREATE
  createCategory = asynchandeler(async (req, res) => {
    const { name, image } = await validateCategory(req);

    const category = await Category.create({
      name,
      image: {
        status: "pending",
        localPath: image.path,
      },
    });

    // Enqueue image upload — worker handles upload, DB update, and cache bump
    await imageQueue.add("create-category-image", {
      categoryId: category._id,
      localPath: image.path,
    });

    // Bump now so any stale "all" / "active" lists are invalidated immediately
    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Category created successfully",
      category.name,
    );
  });

  // GET ALL
  getAllCategories = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "all");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Categories fetched successfully",
        { categories: cached, fromCache: true },
      );
    }

    const categories = await Category.find({ isActive: true })
      .populate({ path: "subcategories", select: "-updatedAt -createdAt" })
      .populate("discount")
      .select("-updatedAt -createdAt")
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      throw new customError("No categories found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, categories, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Categories fetched successfully",
      { categories },
    );
  });

  // GET BY SLUG
  getCategoryBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Category fetched successfully",
        { category: cached, fromCache: true },
      );
    }

    const category = await Category.findOne({ slug, isActive: true })
      .populate({ path: "subcategories", select: "-updatedAt -createdAt" })
      .populate("discount")
      .select("-updatedAt -createdAt")
      .lean();

    if (!category) {
      throw new customError("Category not found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, category, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Category fetched successfully",
      { category },
    );
  });

  // UPDATE
  updateCategory = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findOne({ slug });
    if (!category) {
      throw new customError("Category not found", statusCodes.NOT_FOUND);
    }

    if (req.body.name) category.name = req.body.name;

    if (req.files?.length) {
      const oldPublicId = category.image?.publicId || null;

      // Keep old URL visible until worker finishes uploading the new one
      category.image.status = "pending";
      category.image.localPath = req.files[0].path;
      category.image.tries = 0;
      category.image.lastError = "";

      await imageQueue.add("update-category-image", {
        categoryId: category._id,
        localPath: req.files[0].path,
        oldPublicId,
      });
    }

    const updated = await category.save();
    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Category updated successfully",
      updated,
    );
  });

  // DELETE
  deleteCategory = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findOneAndDelete({ slug });
    if (!category) {
      throw new customError("Category not found", statusCodes.NOT_FOUND);
    }

    await bumpNsVersion(NS);

    // Delete Cloudinary image in background — non-critical after DB delete
    const publicId = category.image?.publicId;
    if (publicId) {
      setImmediate(() =>
        deleteCloudinaryFile(publicId).catch((e) =>
          console.error("[Cloudinary] Delete failed:", e.message),
        ),
      );
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Category deleted successfully",
      { slug },
    );
  });

  // ACTIVATE
  activateCategory = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findOneAndUpdate(
      { slug, isActive: false },
      { isActive: true },
      { new: true },
    );
    if (!category) {
      throw new customError(
        "Category not found or already active",
        statusCodes.NOT_FOUND,
      );
    }

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Category activated successfully",
      category,
    );
  });

  // DEACTIVATE
  deactivateCategory = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findOneAndUpdate(
      { slug, isActive: true },
      { isActive: false },
      { new: true },
    );
    if (!category) {
      throw new customError(
        "Category not found or already inactive",
        statusCodes.NOT_FOUND,
      );
    }

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Category deactivated successfully",
      category,
    );
  });

  // ACTIVE LIST
  getActiveCategories = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "active");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Active categories fetched successfully",
        { categories: cached, fromCache: true },
      );
    }

    const categories = await Category.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      throw new customError(
        "No active categories found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, categories, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Active categories fetched successfully",
      { categories },
    );
  });

  // INACTIVE LIST
  getInactiveCategories = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "inactive");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Inactive categories fetched successfully",
        { categories: cached, fromCache: true },
      );
    }

    const categories = await Category.find({ isActive: false })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      throw new customError(
        "No inactive categories found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, categories, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Inactive categories fetched successfully",
      { categories },
    );
  });

  // SEARCH
  getCategoriesWithSearch = asynchandeler(async (req, res) => {
    const search = String(req.query.search || "").trim();

    if (!search) {
      throw new customError(
        "Search query is required",
        statusCodes.BAD_REQUEST,
      );
    }

    const cacheKey = await buildCacheKey(NS, `search:${search.toLowerCase()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Categories fetched successfully",
        { categories: cached, fromCache: true },
      );
    }

    const safeSearch = escapeRegex(search);

    const categories = await Category.find({
      name: { $regex: safeSearch, $options: "i" },
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      throw new customError("No categories found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, categories, CACHE_TTL_SEARCH);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Categories fetched successfully",
      { categories },
    );
  });

  // SORT
  getCategoriesWithSort = asynchandeler(async (req, res) => {
    const sortObj = parseSortParam(req.query.sort);
    const cacheKey = await buildCacheKey(NS, `sort:${JSON.stringify(sortObj)}`);

    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Categories fetched successfully",
        { categories: cached, fromCache: true },
      );
    }

    const categories = await Category.find({ isActive: true })
      .sort(sortObj)
      .lean();

    if (!categories.length) {
      throw new customError("No categories found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, categories, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Categories fetched successfully",
      { categories },
    );
  });

  // PAGINATION
  getCategoryPagination = asynchandeler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const skip = (page - 1) * limit;

    const cacheKey = await buildCacheKey(NS, `page:${page}:limit:${limit}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Categories fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const [categories, total] = await Promise.all([
      Category.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate("subcategories discount")
        .lean(),
      Category.countDocuments(),
    ]);

    if (!categories.length) {
      throw new customError("No categories found", statusCodes.NOT_FOUND);
    }

    const totalPages = Math.ceil(total / limit);
    const payload = { categories, page, limit, total, totalPages };

    await setCache(cacheKey, payload, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Categories fetched successfully",
      payload,
    );
  });
}

module.exports = new CategoryController();
