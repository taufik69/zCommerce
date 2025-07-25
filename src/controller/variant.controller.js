require("dotenv").config();
const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const validateVariant = require("../validation/variant.validation");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const { uploadBarcodeToCloudinary } = require("../helpers/cloudinary");

// @desc create  variant controller
exports.createVariant = asynchandeler(async (req, res, next) => {
  // Validate the request body
  const validatedData = await validateVariant(req);
  // after variant save

  // Proceed with saving the variant
  const variantData = new variant({ validatedData, ...req.body });
  await variantData.save();
  if (!variantData) {
    throw new customError("Failed to create variant", 500);
  }
  // now make Qr code and barcode and update variant
  // Generate barcode using bwip-js
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: `${validatedData.sku}-${Date.now()}`.toLocaleUpperCase().slice(0, 13), // Unique identifier
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

  // Generate QR code

  const qrCode = await QRCode.toBuffer(
    JSON.stringify(
      `${
        process.env.PRODUCT_QR_URL || "https://www.facebook.com/zahirulislamdev"
      }`
    ), // next time add a frontend product deatil page link
    {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 200,
      height: 200,
      type: "png",
    }
  );
  const base64qrCode = `data:image/png;base64,${qrCode.toString("base64")}`;

  const { optimizeUrl: qrCodeUrl } = await uploadBarcodeToCloudinary(
    base64qrCode
  );
  variantData.barCode = barcodeUrl;
  variantData.qrCode = qrCodeUrl;
  await variantData.save();

  // push the variant to the product's variants array
  const productData = await product.findById(variantData.product);
  if (!productData) {
    throw new customError("Product not found", 404);
  }
  productData.variant.push(variantData._id);
  await productData.save();

  apiResponse.sendSuccess(
    res,
    201,
    "Variant created successfully",
    variantData
  );
});

// @desc get all  variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const variants = await variant
    .find()
    .populate("product")
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
  // const validatedData = await validateVariant(req);
  const updatedVariant = await variant.findOneAndUpdate(
    { slug },
    { ...req.body },
    { new: true }
  );
  if (!updatedVariant) {
    throw new customError("Variant not found", 404);
  }
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
  apiResponse.sendSuccess(
    res,
    200,
    "Variant deleted successfully",
    deletedVariant
  );
});
