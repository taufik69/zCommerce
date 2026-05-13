const { customError } = require("../lib/CustomError");
const Brand = require("../models/brand.model");
const { apiResponse } = require("../utils/apiResponse");
const { validateBrand } = require("../validation/brand.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
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

const NS = "brand";
const CACHE_TTL = 60 * 60; // 1 hour

// ─── controller methods ───────────────────────────────────────────────────────

// @desc    Create a new brand
exports.createBrand = asynchandeler(async (req, res) => {
  const { name, image } = await validateBrand(req);

  const brand = await Brand.create({
    name,
    image: {
      status: "pending",
      localPath: image.path,
    },
  });

  // Enqueue image upload
  await imageQueue.add("create-brand-image", {
    modelName: NS,
    documentId: brand._id,
    localPath: image.path,
  });

  // Invalidate cache
  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Brand created successfully",
    brand.name,
  );
});

// @desc    Get all brands
exports.getAllBrands = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Brands fetched successfully",
      { brands: cached, fromCache: true },
    );
  }

  const brands = await Brand.find({}).sort({ createdAt: -1 }).lean();

  if (!brands.length) {
    throw new customError("Brands not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, brands, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brands fetched successfully",
    { brands: brands, fromCache: false },
  );
});

// @desc    Get single brand by slug
exports.getBrandBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Brand fetched successfully",
      { brand: cached, fromCache: true },
    );
  }

  const brand = await Brand.findOne({ slug }).lean();
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, brand, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand fetched successfully",
    { brand: brand, fromCache: false },
  );
});

// @desc    Update a brand by slug
exports.updateBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOne({ slug });
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }

  if (req.body.name) brand.name = req.body.name;

  if (req.files?.length) {
    const oldPublicId = brand.image?.publicId || null;

    brand.image.status = "pending";
    brand.image.localPath = req.files[0].path;
    brand.image.tries = 0;
    brand.image.lastError = "";

    await imageQueue.add("update-brand-image", {
      modelName: NS,
      documentId: brand._id,
      localPath: req.files[0].path,
      oldPublicId,
    });
  }

  const updated = await brand.save();
  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand updated successfully",
    updated,
  );
});

// @desc    Delete a brand by slug
exports.deleteBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOneAndDelete({ slug });
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  // Background Cloudinary cleanup
  const publicId = brand.image?.publicId;
  if (publicId) {
    setImmediate(() =>
      deleteCloudinaryFile(publicId).catch((e) =>
        console.error("[Cloudinary] Brand image delete failed:", e.message),
      ),
    );
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand deleted successfully",
    { slug },
  );
});

// @desc    Activate a brand by slug
exports.activateBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOneAndUpdate(
    { slug, isActive: false },
    { isActive: true },
    { new: true },
  );

  if (!brand) {
    throw new customError(
      "Brand not found or already active",
      statusCodes.NOT_FOUND,
    );
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand activated successfully",
    brand,
  );
});

// @desc    Deactivate a brand by slug
exports.deactivateBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const brand = await Brand.findOneAndUpdate(
    { slug, isActive: true },
    { isActive: false },
    { new: true },
  );

  if (!brand) {
    throw new customError(
      "Brand not found or already inactive",
      statusCodes.NOT_FOUND,
    );
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand deactivated successfully",
    brand,
  );
});

// @desc    Search brands by name or query
exports.searchBrand = asynchandeler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    throw new customError("Search query is required", statusCodes.BAD_REQUEST);
  }

  const searchQuery = q.trim();
  const cacheKey = await buildCacheKey(NS, `search:${searchQuery}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Brands search results",
      { brands: cached, fromCache: true },
    );
  }

  const brands = await Brand.find({
    $or: [
      { name: { $regex: searchQuery, $options: "i" } },
      { slug: { $regex: searchQuery, $options: "i" } },
    ],
  })
    .lean()
    .sort({ name: 1 });

  if (!brands.length) {
    throw new customError("No brands found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, brands, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Brands search results", {
    brands: brands,
    fromCache: false,
  });
});
