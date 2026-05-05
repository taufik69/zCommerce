const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const Banner = require("../models/banner.model");
const { validateBanner } = require("../validation/banner.Validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "banner";
const CACHE_TTL = 60 * 60; // 1 hour

// create banner
exports.createBanner = asynchandeler(async (req, res, next) => {
  const validatedData = await validateBanner(req, res, next);

  //  Create banner in DB immediately (without waiting for image)
  const banner = await Banner.create({
    ...validatedData,
    image: null,
  });

  //  Send early response to client
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Banner information saved. Image uploading...",
  );

  //  Background image upload and DB update
  (async () => {
    try {
      if (req.file) {
        const imageUpload = await cloudinaryFileUpload(
          validatedData?.image?.path,
        );

        //  Update banner with uploaded image URL
        await Banner.findByIdAndUpdate(banner._id, {
          image: imageUpload.optimizeUrl,
        });

        await bumpNsVersion(NS);
        console.log(` Banner image uploaded and updated for ID: ${banner._id}`);
      } else {
        console.log(`ℹ️ No image file found for banner ID: ${banner._id}`);
      }
    } catch (error) {
      console.error(
        `❌ Image upload failed for banner ID: ${banner._id}:`,
        error.message,
      );
    }
  })();
});

exports.getAllBanner = asynchandeler(async (req, res, next) => {
  // Optional query params: isActive, priority sorting, limit, etc.
  const { isActive, limit, sort } = req.query;

  const cacheKey = await buildCacheKey(
    NS,
    `all:${JSON.stringify({ isActive, limit, sort })}`
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Banners fetched successfully",
      { banners: cached, fromCache: true }
    );
  }

  //  Build filter dynamically
  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  //  Fetch banners
  const banners = await Banner.find(filter)
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
    { banners }
  );
});

// Get single banner by slug
exports.getSingleBanner = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      200,
      "Banner fetched successfully",
      { banner: cached, fromCache: true }
    );
  }

  const banner = await Banner.findOne({ slug, isActive: true });

  if (!banner) {
    return next(new customError("Banner not found", statusCodes.NOT_FOUND));
  }

  await setCache(cacheKey, banner, CACHE_TTL);

  apiResponse.sendSuccess(res, 200, "Banner fetched successfully", { banner });
});

// ===============================
// Update Banner Controller
// ===============================
exports.updateBanner = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;

  //  Step 1: Find existing banner
  const banner = await Banner.findOne({ slug, isActive: true });
  if (!banner) {
    throw new customError("Banner not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Validate banner input (only basic fields)
  const validatedData = await validateBanner(req, res, next);

  // Step 3: Send immediate success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banner update request accepted. Processing in background...",
    { slug },
  );

  //  Step 4: Background update logic (non-blocking)
  (async () => {
    try {
      let newImageUrl = banner.image;

      // If a new image is uploaded
      if (req.file) {
        // --- Delete old image from Cloudinary ---
        if (banner.image) {
          try {
            const parts = banner.image.split("/");
            const publicId = parts[parts.length - 1].split(".")[0];
            if (publicId) {
              await deleteCloudinaryFile(publicId.split("?")[0]);
              console.log(`🗑️ Old banner image deleted for: ${banner._id}`);
            }
          } catch (err) {
            console.warn(
              `⚠️ Failed to delete old image for banner ${banner._id}: ${err.message}`,
            );
          }
        }

        // --- Upload new image ---
        const uploadResult = await cloudinaryFileUpload(req.file.path);
        if (!uploadResult) {
          throw new customError(
            "New image upload failed",
            statusCodes.SERVER_ERROR,
          );
        }
        newImageUrl = uploadResult.optimizeUrl;
      }

      //  Update banner fields
      banner.headLine = validatedData.headLine || banner.headLine;
      banner.details = validatedData.details || banner.details;
      banner.image = newImageUrl;

      await banner.save();
      await bumpNsVersion(NS);
      console.log(`✅Banner successfully updated: ${banner._id}`);
    } catch (error) {
      console.error(` Background banner update failed: ${error.message}`);
    }
  })();
});

// ===============================
// Delete Banner Controller
// ===============================
exports.deleteBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  //  Step 1: Find banner by slug
  const banner = await Banner.findOneAndDelete({ slug });
  if (!banner) {
    throw new customError("Banner not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Immediately mark banner inactive (soft delete)
  banner.isActive = false;
  await banner.save();

  await bumpNsVersion(NS);

  // Step 3: Send immediate success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Banner delete request accepted. Processing in background...",
    { slug },
  );

  //  Step 4: Background cleanup (non-blocking)
  (async () => {
    try {
      // --- Delete image from Cloudinary ---
      if (banner.image) {
        try {
          const parts = banner.image.split("/");
          const publicId = parts[parts.length - 1].split(".")[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId.split("?")[0]);
            console.log(
              `🗑️ Cloudinary image deleted for banner: ${banner._id}`,
            );
          }
        } catch (err) {
          console.warn(
            `⚠️ Failed to delete Cloudinary image for banner ${banner._id}: ${err.message}`,
          );
        }
      }

      console.log(`✅ Banner permanently deleted: ${banner._id}`);
    } catch (error) {
      console.error(`❌ Background banner delete failed: ${error.message}`);
    }
  })();
});
