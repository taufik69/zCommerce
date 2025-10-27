const { customError } = require("../lib/CustomError");
const Brand = require("../models/brand.model");
const { apiResponse } = require("../utils/apiResponse");
const { validateBrand } = require("../validation/brand.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
// @desc    Create a new brand
// @route   POST /api/v1/brand
exports.createBrand = asynchandeler(async (req, res) => {
  const { name } = req.body;
  const files = req.files;

  // ✅ Validation
  if (!Array.isArray(name) || name.length === 0) {
    throw new customError("At least one brand name is required", 400);
  }

  if (!files || files.length === 0) {
    throw new customError("At least one brand image is required", 400);
  }

  if (name.length !== files.length) {
    throw new customError("Each brand must have an image", 400);
  }

  // ✅ Send immediate response (non-blocking)
  apiResponse.sendSuccess(
    res,
    202,
    "Brands created successfully. Processing in background."
  );

  // ✅ Background processing (fire-and-forget)
  (async () => {
    try {
      let savedBrands = [];

      for (let i = 0; i < name.length; i++) {
        const imageUpload = await cloudinaryFileUpload(files[i].path);

        const brand = new Brand({
          name: name[i],
          image: imageUpload.optimizeUrl,
        });

        await brand.save();
        savedBrands.push(brand);
      }

      console.log(
        "✅ Background Brand Creation Completed:",
        savedBrands.length
      );
    } catch (error) {
      console.error("❌ Background brand creation failed:", error.message);
    }
  })();
});

// get all brands
exports.getAllBrands = asynchandeler(async (req, res, next) => {
  const brands = await Brand.find({ isActive: true }).sort({ createdAt: -1 });
  return apiResponse.sendSuccess(res, 200, "Brands fetched successfully", {
    brands,
  });
});

// get single brand by slug
exports.getBrandBySlug = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", 404);
  }
  return apiResponse.sendSuccess(res, 200, "Brand fetched successfully", {
    brand,
  });
});

// @desc    Update a brand by slug
exports.updateBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Step 1: Find the brand
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", 404);
  }

  // ✅ Step 2: Send immediate response (non-blocking)
  apiResponse.sendSuccess(
    res,
    202,
    "Brand update is successfully. Processing in background.",
    { slug }
  );

  // ✅ Step 3: Background processing (fire-and-forget)
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
            console.warn(`⚠️ Invalid image URL for brand: ${brand._id}`);
          }
        });

        await Promise.all(deletePromises);

        // Upload new images
        const uploadPromises = req.files.map(async (file) => {
          const result = await cloudinaryFileUpload(file.path);
          if (!result) {
            throw new customError("Image upload failed", 500);
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
      console.log(`✅ Background brand update completed: ${brand._id}`);
    } catch (error) {
      console.error(`❌ Background brand update failed:`, error.message);
    }
  })();
});

// @desc    Delete a brand by slug
exports.deleteBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Step 1: Find the brand
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", 404);
  }

  // ✅ Step 2: Send immediate response (non-blocking)
  apiResponse.sendSuccess(
    res,
    202,
    "Brand deletion is successfully being processed in the background",
    { slug }
  );

  // ✅ Step 3: Background processing (fire-and-forget)
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

      // Delete the brand document from DB
      await Brand.deleteOne({ slug });
      console.log(`✅ Background brand deletion completed: ${slug}`);
    } catch (error) {
      console.error(
        `❌ Background brand deletion failed: ${slug}`,
        error.message
      );
    }
  })();
});
