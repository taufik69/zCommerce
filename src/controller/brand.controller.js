const { customError } = require("../lib/CustomError");
const Brand = require("../models/brand.model");
const { apiResponse } = require("../utils/apiResponse");
const { validateBrand } = require("../validation/brand.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");
// @desc    Create a new brand
// @route   POST /api/v1/brand
exports.createBrand = asynchandeler(async (req, res, next) => {
  const value = await validateBrand(req, res, next);

  const brand = await Brand.create({
    name: value.name,
    image: null,
  });
  if (!brand) {
    throw new customError("Brand creation failed", statusCodes.SERVER_ERROR);
  }

  //  Send Immediate Response (Client doesn't wait)
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Brand creation started. Processing in background...",
    brand,
  );

  // Background Async Task
  (async () => {
    try {
      // Upload Image in background
      const { optimizeUrl } = await cloudinaryFileUpload(value.image.path);

      // now push the image url into the database
      await Brand.findByIdAndUpdate(brand._id, {
        image: optimizeUrl,
      });

      console.log(" Brand Created (BG Task):", brand.name);
    } catch (error) {
      console.error("Background Brand Creation Failed:", error.message);
    }
  })();
});

// get all brands
exports.getAllBrands = asynchandeler(async (req, res, next) => {
  const brands = await Brand.find({ isActive: true }).sort({ createdAt: -1 });
  if (!brands || brands.length === 0) {
    throw new customError("Brands not found", statusCodes.NOT_FOUND);
  }
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brands fetched successfully",
    brands,
  );
});

// get single brand by slug
exports.getBrandBySlug = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand fetched successfully",
    brand,
  );
});

// @desc    Update a brand by slug
exports.updateBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  //  Step 1: Find the brand
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Send immediate response (non-blocking)
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand update is successfully. Processing in background.",
    { slug },
  );

  //  Step 3: Background processing (fire-and-forget)
  (async () => {
    try {
      let optimizeUrlsCloudinary = [];

      if (req?.files?.length) {
        // Delete old images
        const deletePromises = brand.image.map(async (imageUrl) => {
          const match = imageUrl.split("/");
          const publicId = match[match.length - 1].split(".")[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId.split("?")[0]);
          } else {
            console.warn(` Invalid image URL for brand: ${brand._id}`);
          }
        });

        await Promise.all(deletePromises);

        // Upload new images
        const uploadPromises = req.files.map(async (file) => {
          const result = await cloudinaryFileUpload(file.path);
          if (!result) {
            throw new customError(
              "Image upload failed",
              statusCodes.SERVER_ERROR,
            );
          }
          return result.optimizeUrl;
        });

        optimizeUrlsCloudinary = await Promise.all(uploadPromises);
      }

      // Update brand in DB
      brand.name = req.body.name || brand.name;
      if (optimizeUrlsCloudinary.length > 0) {
        brand.image = optimizeUrlsCloudinary;
      }

      await brand.save();
      console.log(` Background brand update completed: ${brand._id}`);
    } catch (error) {
      console.error(` Background brand update failed:`, error.message);
    }
  })();
});

// @desc    Delete a brand by slug
exports.deleteBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  //  Step 1: Find the brand
  const brand = await Brand.findOneAndDelete({ slug });
  if (!brand) {
    throw new customError("Brand not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Send immediate response (non-blocking)
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Brand deletion is successfully being processed in the background",
    { slug },
  );

  //  Step 3: Background processing (fire-and-forget)
  (async () => {
    try {
      if (brand.image?.length > 0) {
        const deletePromises = brand.image.map(async (imageUrl) => {
          const match = imageUrl.split("/");
          const publicId = match[match.length - 1].split(".")[0]; // Extract public ID

          if (publicId) {
            await deleteCloudinaryFile(publicId.split("?")[0]);
            console.log(`🗑️ Deleted Cloudinary image: ${publicId}`);
          } else {
            console.warn(`⚠️ Invalid image URL for brand: ${brand._id}`);
          }
        });

        await Promise.all(deletePromises);
      }

      console.log(`✅ Background brand deletion completed: ${slug}`);
    } catch (error) {
      console.error(
        `❌ Background brand deletion failed: ${slug}`,
        error.message,
      );
    }
  })();
});
