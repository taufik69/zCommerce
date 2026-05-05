const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const discountBanner = require("../models/discountbanner.model");
const {
  validateDiscountBanner,
} = require("../validation/discountBanner.validation");
const { statusCodes } = require("../constant/constant");
const { imageQueue } = require("@/queues/image.queue");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "discountBanner";
const CACHE_TTL = 60 * 60; // 1 hour

// create banner
exports.createDiscountBanner = asynchandeler(async (req, res, next) => {
  const validatedData = await validateDiscountBanner(req);
  const { image: imageFile, ...rest } = validatedData;

  //  Create banner in DB immediately with pending image status
  const banner = await discountBanner.create({
    ...rest,
    image: imageFile
      ? {
          status: "pending",
          localPath: imageFile.path,
        }
      : undefined,
  });

  if (!banner) {
    throw new customError("Banner creation failed", statusCodes.SERVER_ERROR);
  }

  // Enqueue image upload if provided
  if (imageFile && imageFile.path) {
    await imageQueue.add("create-discountBanner-image", {
      modelName: NS,
      documentId: banner._id,
      localPath: imageFile.path,
    });
  }

  // Invalidate cache
  await bumpNsVersion(NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Banner created successfully (image uploading in background)",
    banner.title,
  );
});

exports.getAllDiscountBanner = asynchandeler(async (req, res) => {
  // Optional query params: isActive, priority sorting, limit, etc.
  const { isActive, limit, sort } = req.query;

  const cacheKey = await buildCacheKey(
    NS,
    `all:${JSON.stringify({ isActive, limit, sort })}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Banners fetched successfully (from cache)",
      cached,
    );
  }

  // Build filter dynamically
  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }
  // Fetch banners
  const banners = await discountBanner
    .find(filter)
    .sort(sort ? { priority: sort === "asc" ? 1 : -1 } : { createdAt: -1 })
    .limit(limit ? parseInt(limit) : 0);

  if (!banners || banners.length === 0) {
    throw new customError("No banners found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, banners, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banners fetched successfully",
    banners,
  );
});

// Get single banner by slug
exports.getSingleDiscountBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Banner fetched successfully (from cache)",
      cached,
    );
  }

  const banner = await discountBanner.findOne({ slug, isActive: true });

  if (!banner) {
    throw new customError("Banner not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, banner, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banner fetched successfully",
    banner,
  );
});

// ===============================
// Update Banner Controller
// ===============================
exports.updateDiscountBanner = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;

  //  Step 1: Find existing banner
  const banner = await discountBanner.findOne({ slug });
  if (!banner) {
    throw new customError("Banner not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Validate banner input
  const validatedData = await validateDiscountBanner(req, true);
  const { image: imageFile, ...rest } = validatedData;

  // Step 3: Handle image update via queue if file present
  if (req.file) {
    const oldPublicId = banner.image?.publicId || null;

    // Update status to pending
    banner.image.status = "pending";
    banner.image.localPath = req.file.path;
    banner.image.tries = 0;
    banner.image.lastError = "";

    await imageQueue.add("update-discountBanner-image", {
      modelName: NS,
      documentId: banner._id,
      localPath: req.file.path,
      oldPublicId,
    });
  }

  // Step 4: Update other fields
  Object.assign(banner, rest);
  const updatedBanner = await banner.save();

  // Step 5: Invalidate cache and send response
  await bumpNsVersion(NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banner updated successfully",
    updatedBanner,
  );
});

// ===============================
// Delete Banner Controller
// ===============================
exports.deleteDiscountBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  //  Step 1: Find and delete banner
  const banner = await discountBanner.findOneAndDelete({ slug });
  if (!banner) {
    throw new customError("Banner not found", statusCodes.NOT_FOUND);
  }

  // Step 2: Invalidate cache
  await bumpNsVersion(NS);

  // Step 3: Delete image from Cloudinary via queue
  const publicId = banner.image?.publicId;
  if (publicId) {
    await imageQueue.add("delete-cloudinary-image", { publicId });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banner deleted successfully",
    { slug },
  );
});
