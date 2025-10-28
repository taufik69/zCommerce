const { customError } = require("../lib/CustomError");
const Brand = require("../models/brand.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const Banner = require("../models/banner.model");
const { validateBanner } = require("../validation/banner.Validation");

// create banner
exports.createBanner = asynchandeler(async (req, res) => {
  const validatedData = await validateBanner(req);

  //  Create banner in DB immediately (without waiting for image)
  const banner = await Banner.create({
    ...validatedData,
    image: null,
  });

  //  Send early response to client
  apiResponse.sendSuccess(
    res,
    202,
    "Banner information saved. Image uploading..."
  );

  //  Background image upload and DB update
  (async () => {
    try {
      if (req.file) {
        const imageUpload = await cloudinaryFileUpload(
          validatedData?.image?.path
        );

        //  Update banner with uploaded image URL
        await Banner.findByIdAndUpdate(banner._id, {
          image: imageUpload.optimizeUrl,
        });

        console.log(
          `✅ Banner image uploaded and updated for ID: ${banner._id}`
        );
      } else {
        console.log(`ℹ️ No image file found for banner ID: ${banner._id}`);
      }
    } catch (error) {
      console.error(
        `❌ Image upload failed for banner ID: ${banner._id}:`,
        error.message
      );
    }
  })();
});

exports.getAllBanner = asynchandeler(async (req, res) => {
  // Optional query params: isActive, priority sorting, limit, etc.
  const { isActive, limit, sort } = req.query;

  // ✅ Build filter dynamically
  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  // ✅ Fetch banners
  const banners = await Banner.find(filter)
    .sort(sort ? { priority: sort === "asc" ? 1 : -1 } : { createdAt: -1 })
    .limit(limit ? parseInt(limit) : 0);

  if (!banners || banners.length === 0) {
    throw new customError("No banners found", 404);
  }

  apiResponse.sendSuccess(res, 200, "Banners fetched successfully", banners);
});

// Get single banner by slug
exports.getSingleBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const banner = await Banner.findOne({ slug, isActive: true });

  if (!banner) {
    throw new customError("Banner not found", 404);
  }

  apiResponse.sendSuccess(res, 200, "Banner fetched successfully", banner);
});

// ===============================
// Update Banner Controller
// ===============================
exports.updateBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Step 1: Find existing banner
  const banner = await Banner.findOne({ slug, isActive: true });
  if (!banner) {
    throw new customError("Banner not found", 404);
  }

  // ✅ Step 2: Validate banner input (only basic fields)
  const validatedData = await validateBanner(req);

  // ✅ Step 3: Send immediate success response
  apiResponse.sendSuccess(
    res,
    200,
    "Banner update request accepted. Processing in background...",
    { slug }
  );

  // ✅ Step 4: Background update logic (non-blocking)
  (async () => {
    try {
      let newImageUrl = banner.image;

      // ✅ If a new image is uploaded
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
              `⚠️ Failed to delete old image for banner ${banner._id}: ${err.message}`
            );
          }
        }

        // --- Upload new image ---
        const uploadResult = await cloudinaryFileUpload(req.file.path);
        if (!uploadResult) {
          throw new customError("New image upload failed", 500);
        }
        newImageUrl = uploadResult.optimizeUrl;
      }

      // ✅ Update banner fields
      banner.headLine = validatedData.headLine || banner.headLine;
      banner.details = validatedData.details || banner.details;
      banner.image = newImageUrl;

      await banner.save();

      console.log(`✅ Banner successfully updated: ${banner._id}`);
    } catch (error) {
      console.error(`❌ Background banner update failed: ${error.message}`);
    }
  })();
});

// ===============================
// Delete Banner Controller
// ===============================
exports.deleteBanner = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Step 1: Find banner by slug
  const banner = await Banner.findOne({ slug, isActive: true });
  if (!banner) {
    throw new customError("Banner not found", 404);
  }

  // ✅ Step 2: Immediately mark banner inactive (soft delete)
  banner.isActive = false;
  await banner.save();

  // ✅ Step 3: Send immediate success response
  apiResponse.sendSuccess(
    res,
    200,
    "Banner delete request accepted. Processing in background...",
    { slug }
  );

  // ✅ Step 4: Background cleanup (non-blocking)
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
              `🗑️ Cloudinary image deleted for banner: ${banner._id}`
            );
          }
        } catch (err) {
          console.warn(
            `⚠️ Failed to delete Cloudinary image for banner ${banner._id}: ${err.message}`
          );
        }
      }

      // --- Delete banner from DB ---
      await Banner.findByIdAndDelete(banner._id);
      console.log(`✅ Banner permanently deleted: ${banner._id}`);
    } catch (error) {
      console.error(`❌ Background banner delete failed: ${error.message}`);
    }
  })();
});
