const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { validateProduct } = require("../validation/product.validation");
const { log } = require("console");


// Create a new product (only required fields)
exports.createProduct = asynchandeler(async (req, res) => {
  // Validate required fields
  const value = await validateProduct(req);
  const {
    name,
    description,
    category,
    subcategory,
    brand,
    variantType,
    retailPrice,
  } = value;

  // Manual image validation (already handled in validateProduct)
  // upload images to cloudinary
  const imageUploads = req.files.image
    ? await Promise.all(
        req.files.image.map((file) => cloudinaryFileUpload(file.path))
      )
    : [];
  console.log("Image Uploads:", imageUploads);
  return;

  const thumbnailUpload = req.files.thumbnail
    ? await cloudinaryFileUpload(req.files.thumbnail[0].path)
    : null;

  // Create product
  const product = new Product({
    name,
    description,
    category,
    subcategory,
    brand,
    variantType,
    retailPrice,
    ...req.body,
    // Optionally handle image and thumbnail upload here
  });

  await product.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Product created successfully",
    product
  );
});
