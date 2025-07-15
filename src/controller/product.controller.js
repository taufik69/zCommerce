const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");

const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
  uploadBarcodeToCloudinary,
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
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    size,
    color,
  } = value;

  // Generate SKU based on name, color, size, and timestamp

  const namePrefix = name?.slice(0, 3).toUpperCase() || "NON";
  const colorPrefix = color?.slice(0, 2).toUpperCase() || "CL";
  const sizePrefix = size?.toString().toUpperCase() || "SZ";
  const timestamp = Date.now().toString().slice(-6);
  const sku = `${namePrefix}-${colorPrefix}-${sizePrefix}-${timestamp}`;

  // make a qr code for product
  const qrCodeData = {
    name,
    brand,
    retailPrice,
  };

  const qrCode = await QRCode.toBuffer(JSON.stringify(qrCodeData), {
    errorCorrectionLevel: "H",
  });
  const base64qrCode = `data:image/png;base64,${qrCode.toString("base64")}`;

  // upload qr code to cloudinary
  const { optimizeUrl: qrCodeUrl } = await uploadBarcodeToCloudinary(
    base64qrCode
  );

  // Generate barcode using bwip-js
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: sku,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
    // No need for output: 'svg'
  });

  const base64Barcode = `data:image/png;base64,${barcode.toString("base64")}`;
  // upload barcode to cloudinary
  const { optimizeUrl: barcodeUrl } = await uploadBarcodeToCloudinary(
    base64Barcode
  );

  // upload images to cloudinary
  const imageUploads = req.files.image
    ? await Promise.all(
        req.files.image.map((file) => cloudinaryFileUpload(file.path))
      )
    : [];
  const imageUrls = imageUploads.map((img) => img.optimizeUrl);

  // Handle thumbnail upload
  const thumbnailUpload = req.files.thumbnail
    ? await cloudinaryFileUpload(req.files.thumbnail[0].path)
    : null;
  const thumbnailUrl = thumbnailUpload ? thumbnailUpload.optimizeUrl : null;
  // Create product
  const product = new Product({
    name,
    qrCode: qrCodeUrl || null,
    barCode: barcodeUrl || null,
    sku,
    description,
    category,
    subcategory,
    brand,
    variantType,
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    image: imageUrls,
    thumbnail: thumbnailUrl,
    ...req.body,
  });

  await product.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Product created successfully",
    product
  );
});
