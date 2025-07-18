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
exports.createBrand = asynchandeler(async (req, res, next) => {
  const { name } = await validateBrand(req);
  //   upload image on cloudinary using promise.all beacuse brannd have multiple image
  const images = await Promise.all(
    req.files.map(async (file) => {
      const result = await cloudinaryFileUpload(file.path);
      if (!result) {
        throw new customError("Image upload failed", 500);
      }
      return result.optimizeUrl;
    })
  );
  console.log("images", images);

  const brand = await Brand.create({
    name,
    image: images,
  });

  return apiResponse.sendSuccess(res, 201, "Brand created successfully", brand);
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

  // Find the brand by slug
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", 404);
  }

  let optimizeUrlsCloudinary = [];

  // Check if new images are provided
  if (req?.files?.length) {
    // Delete all old images from Cloudinary
    const deletePromises = brand.image.map(async (imageUrl) => {
      const match = imageUrl.split("/");
      const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL

      if (!publicId) {
        throw new customError("Invalid image URL", 400);
      }

      await deleteCloudinaryFile(publicId.split("?")[0]);
    });

    await Promise.all(deletePromises); // Wait for all deletions to complete

    // Upload the new images to Cloudinary
    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinaryFileUpload(file.path);

      if (!result) {
        throw new customError("Image upload failed", 500);
      }
      return result.optimizeUrl; // Return the optimized URL
    });

    optimizeUrlsCloudinary = await Promise.all(uploadPromises); // Wait for all uploads to finish
  }

  // Update the brand in the database
  brand.name = req.body.name || brand.name;
  if (optimizeUrlsCloudinary.length > 0) {
    brand.image = optimizeUrlsCloudinary; // Replace all images
  }
  await brand.save();

  // Send success response
  apiResponse.sendSuccess(res, 200, "Brand updated successfully", {
    brand,
  });
});

// @desc    Delete a brand by slug
exports.deleteBrand = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the brand by slug
  const brand = await Brand.findOne({ slug, isActive: true });
  if (!brand) {
    throw new customError("Brand not found", 404);
  }

  // Delete all images from Cloudinary
  const deletePromises = brand.image.map(async (imageUrl) => {
    const match = imageUrl.split("/");
    const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL
    console.log("publicId", publicId.split("?")[0]);

    if (!publicId) {
      throw new customError("Invalid image URL", 400);
    }

    await deleteCloudinaryFile(publicId.split("?")[0]);
  });
  await Promise.all(deletePromises); // Wait for all deletions to complete

  // delete the brand from the database
  // await Brand.deleteOne({ slug });

  // Send success response
  apiResponse.sendSuccess(res, 200, "Brand deleted successfully", {
    brand,
  });
});
