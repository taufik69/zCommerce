require("dotenv").config();
const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const validateVariant = require("../validation/variant.validation");

const {
  uploadBarcodeToCloudinary,
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");

// @desc create  variant controller
exports.createVariant = asynchandeler(async (req, res) => {
  const { variants } = req.body; // এখানে variants আসবে array of objects হিসেবে
  const files = req.files;

  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    throw new customError("At least one variant is required", 400);
  }

  if (!files || files.length === 0) {
    throw new customError("At least one variant image is required", 400);
  }

  if (variants.length !== files.length) {
    throw new customError("Each variant must have a corresponding image", 400);
  }

  let savedVariants = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];

    // validate variant data with Joi
    const validatedData = await validateVariant(v);

    // upload corresponding image
    const imageUpload = await cloudinaryFileUpload(files[i].path);

    // create variant document
    const variantData = new variant({
      ...validatedData,
      image: imageUpload?.optimizeUrl || "N/A",
    });

    await variantData.save();

    // attach variant to product
    await product.findByIdAndUpdate(variantData.product, {
      $push: { variant: variantData._id },
    });

    savedVariants.push(variantData);
  }

  apiResponse.sendSuccess(
    res,
    201,
    "Variants created successfully",
    savedVariants
  );
});

// @desc get all  variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const variants = await variant
    .find()
    .populate({
      path: "product",
      populate: [{ path: "subcategory", select: "name" }],
    })
    .select("-updatedAt")
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(res, 200, "Variants fetched successfully", variants);
});

// @desc get single variant
exports.getSingleVariant = asynchandeler(async (req, res, next) => {
  const slug = req.params.slug;
  const singleVariant = await variant
    .findOne({ slug })
    .populate("product")
    .select("-updatedAt");
  if (!singleVariant) {
    throw new customError("Variant not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Variant fetched successfully",
    singleVariant
  );
});

// @desc update variant using req.params
exports.updateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the variant first
  const existingVariant = await variant.findOne({ slug });
  if (!existingVariant) {
    throw new customError("Variant not found", 404);
  }

  // Handle image update if new image is provided
  let updatedImageUrl = existingVariant.image;
  if (req.files && req.files.length > 0) {
    // Delete previous image from cloudinary if exists
    if (existingVariant.image) {
      // cloudinary public_id extract (assuming image url contains public_id)
      const match = existingVariant.image.split("/");
      const publicId = match[match.length - 1].split(".")[0];
      await deleteCloudinaryFile(publicId);
    }
    // Upload new image
    const imageUpload = await cloudinaryFileUpload(req.files[0].path);
    updatedImageUrl = imageUpload.optimizeUrl;
  }

  // Update variant
  const updatedVariant = await variant.findOneAndUpdate(
    { slug },
    { ...req.body, image: updatedImageUrl },
    { new: true }
  );

  apiResponse.sendSuccess(
    res,
    200,
    "Variant updated successfully",
    updatedVariant
  );
});

// @desc deactivateVariant variant
exports.deactivateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToDeactivate = await variant.findOne({ slug });
  if (!variantToDeactivate) {
    throw new customError("Variant not found", 404);
  }
  variantToDeactivate.isActive = false;
  await variantToDeactivate.save();
  apiResponse.sendSuccess(
    res,
    200,
    "Variant deactivated successfully",
    variantToDeactivate
  );
});

// @desc activate Variant
exports.activateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToActivate = await variant.findOne({ slug });
  if (!variantToActivate) {
    throw new customError("Variant not found", 404);
  }
  variantToActivate.isActive = true;
  await variantToActivate.save();
  apiResponse.sendSuccess(
    res,
    200,
    "Variant activated successfully",
    variantToActivate
  );
});

// @desc delete variant
exports.deleteVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const deletedVariant = await variant.findOneAndDelete({ slug });
  if (!deletedVariant) {
    throw new customError("Variant not found", 404);
  }
  // remve the variant from the product's variants array
  const productData = await product.findById(deletedVariant.product);
  if (!productData) {
    throw new customError("Product not found", 404);
  }
  productData.variant.pull(deletedVariant._id);
  await productData.save();

  const match = deletedVariant.image.split("/");
  const publicId = match[match.length - 1].split(".")[0];
  await deleteCloudinaryFile(publicId);
  apiResponse.sendSuccess(
    res,
    200,
    "Variant deleted successfully",
    deletedVariant
  );
});
