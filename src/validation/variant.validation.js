const Joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const mongoose = require("mongoose");
const { expandBracketKeys } = require("../utils/parseFormData.util");

// ─── Reusable schemas ─────────────────────────────────────────────────────────

const seoFieldsSchema = {
  metaTitle: Joi.string().trim().max(70).allow(""),
  metaDescription: Joi.string().trim().max(200).allow(""),
  metaKeywords: Joi.array().items(Joi.string().trim().lowercase()),
  canonicalUrl: Joi.string().trim().uri().allow(""),
  focusKeyword: Joi.string().trim().lowercase().allow(""),
  ogTitle: Joi.string().trim().max(70).allow(""),
  ogDescription: Joi.string().trim().max(200).allow(""),
  twitterCard: Joi.string().valid("summary", "summary_large_image", "app", "player"),
  noIndex: Joi.boolean(),
  noFollow: Joi.boolean(),
};

const dimensionsField = Joi.object({
  width: Joi.number().min(0),
  height: Joi.number().min(0),
  depth: Joi.number().min(0),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const validateImageFile = (file, label) => {
  if (file && file.size > MAX_FILE_SIZE) {
    throw new customError(
      `${label} size must be less than 5 MB`,
      statusCodes.BAD_REQUEST,
    );
  }
};

const getVariantFile = (files = [], index, fieldName) => {
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  return (
    fileList.find((f) => f.fieldname === `variants[${index}][${fieldName}]`) ||
    fileList.filter((f) => f.fieldname === fieldName)[index]
  );
};

// ─── Variant Schema ──────────────────────────────────────────────────────────

const VariantSchema = Joi.object({
  product: Joi.string().required().messages({
    "string.empty": "Product ID is required",
    "any.required": "Product ID is required",
  }),
  variantName: Joi.string().trim().required().messages({
    "string.empty": "Variant name is required",
    "any.required": "Variant name is required",
  }),
  size: Joi.string().trim().default("N/A"),
  color: Joi.string().trim().default("N/A"),
  stockVariant: Joi.number().min(0).default(0),
  purchasePrice: Joi.number().min(0).required(),
  retailPrice: Joi.number().min(0).required(),
  wholesalePrice: Joi.number().min(0).optional(),
  retailProfitMarginByPercentage: Joi.number().min(0).max(100).optional().allow(null),
  wholesaleProfitMarginPercentage: Joi.number().min(0).max(100).optional().allow(null),
  alertQuantity: Joi.number().min(0).optional(),
  sku: Joi.string().trim().optional(),
  barCode: Joi.string().trim().optional(),
  qrCode: Joi.string().trim().optional(),
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsField.optional(),
  ...seoFieldsSchema,
  seo: Joi.object(seoFieldsSchema).optional(),
}).options({ abortEarly: false, allowUnknown: true });

// ─── Validators ───────────────────────────────────────────────────────────────

const validateVariant = async (variantObj, files = {}) => {
  const Variant = mongoose.models.Variant || require("../models/variant.model");
  try {
    const expandedVariantObj = expandBracketKeys(variantObj);
    const value = await VariantSchema.validateAsync(expandedVariantObj);

    // DB Uniqueness check
    const query = [];
    if (value.sku) query.push({ sku: value.sku });
    if (value.barCode) query.push({ barCode: value.barCode });

    if (query.length > 0) {
      const existing = await Variant.findOne({ $or: query });
      if (existing) {
        if (value.sku && existing.sku === value.sku)
          throw new customError(`SKU ${value.sku} already exists`, 400);
        if (value.barCode && existing.barCode === value.barCode)
          throw new customError(`Barcode ${value.barCode} already exists`, 400);
      }
    }
    
    // File validation
    const thumbnail = getVariantFile(
      files,
      expandedVariantObj.index,
      "thumbnail",
    );
    const nestedGalleryFiles = files.filter(f => f.fieldname === `variants[${expandedVariantObj.index}][image]`);
    const flatGalleryFiles = files.filter(f => f.fieldname === 'image');
    
    // Choose which set of files to validate for this variant
    const variantImages = nestedGalleryFiles.length > 0 
      ? nestedGalleryFiles 
      : (flatGalleryFiles[expandedVariantObj.index] ? [flatGalleryFiles[expandedVariantObj.index]] : []);

    const ogImage = getVariantFile(files, expandedVariantObj.index, "ogImage");

    if (variantImages.length > 10) {
      throw new customError("Maximum 10 images allowed per variant", 400);
    }

    variantImages.forEach((img, idx) => validateImageFile(img, `Variant Image ${idx + 1}`));
    if (thumbnail) validateImageFile(thumbnail, "Variant Thumbnail");
    if (ogImage) validateImageFile(ogImage, "Variant OG Image");

    return value;
  } catch (error) {
    if (error instanceof customError) throw error;
    throw new customError(
      "Variant Validation error: " +
        (error.details ? error.details.map((err) => err.message).join(", ") : error.message),
      400
    );
  }
};

const validateVariantUpdate = async (variantObj, files = {}, currentId = null) => {
  const Variant = mongoose.models.Variant || require("../models/variant.model");
  try {
    const expandedVariantObj = expandBracketKeys(variantObj);
    const value = await VariantSchema.validateAsync(expandedVariantObj, {
      noDefaults: true, // Don't apply defaults for updates
    });

    // DB Uniqueness check (excluding current variant)
    const query = [];
    if (value.sku) query.push({ sku: value.sku });
    if (value.barCode) query.push({ barCode: value.barCode });

    if (query.length > 0) {
      const existing = await Variant.findOne({
        $or: query,
        _id: { $ne: currentId },
      });
      if (existing) {
        if (value.sku && existing.sku === value.sku)
          throw new customError(`SKU ${value.sku} already exists`, 400);
        if (value.barCode && existing.barCode === value.barCode)
          throw new customError(`Barcode ${value.barCode} already exists`, 400);
      }
    }

    const thumbnail =
      getVariantFile(files, expandedVariantObj.index, "thumbnail") ||
      getVariantFile(files, 0, "thumbnail");
    const ogImage =
      getVariantFile(files, expandedVariantObj.index, "ogImage") ||
      getVariantFile(files, 0, "ogImage");
    if (thumbnail) validateImageFile(thumbnail, "Variant Thumbnail");
    if (ogImage) validateImageFile(ogImage, "Variant OG Image");

    return value;
  } catch (error) {
    if (error instanceof customError) throw error;
    throw new customError(
      "Variant Update Validation error: " +
        (error.details
          ? error.details.map((err) => err.message).join(", ")
          : error.message),
      400,
    );
  }
};

module.exports = {
  validateVariant,
  validateVariantUpdate,
};
