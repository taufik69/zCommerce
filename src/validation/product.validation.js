const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { expandBracketKeys } = require("../utils/parseFormData.util");

// ─── Reusable schemas ─────────────────────────────────────────────────────────

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = joi.string().pattern(objectIdRegex).messages({
  "string.pattern.base": "Invalid ObjectId format",
});

const seoFieldsSchema = {
  metaTitle: joi.string().trim().max(70).allow(""),
  metaDescription: joi.string().trim().max(200).allow(""),
  metaKeywords: joi.array().items(joi.string().trim().lowercase()),
  canonicalUrl: joi.string().trim().uri().allow(""),
  focusKeyword: joi.string().trim().lowercase().allow(""),
  ogTitle: joi.string().trim().max(70).allow(""),
  ogDescription: joi.string().trim().max(200).allow(""),
  ogImage: joi
    .object({
      url: joi.string().allow(""),
      publicId: joi.string().allow(""),
      status: joi.string().valid("pending", "processing", "uploaded", "failed"),
      localPath: joi.string().allow(""),
      tries: joi.number(),
      lastError: joi.string().allow(""),
    })
    .optional(),
  twitterCard: joi
    .string()
    .valid("summary", "summary_large_image", "app", "player"),
  structuredData: joi
    .alternatives()
    .try(
      joi.object(),
      joi.string().custom((value, helpers) => {
        try {
          return JSON.parse(value);
        } catch (e) {
          return helpers.error("any.invalid");
        }
      }),
    )
    .allow(null, ""),
  noIndex: joi.boolean(),
  noFollow: joi.boolean(),
};

const seoFields = joi.object(seoFieldsSchema).unknown(false);

const dimensionsField = joi.object({
  width: joi.number().min(0),
  height: joi.number().min(0),
  depth: joi.number().min(0),
});

// ─── Create product schema (strict — strips unknown fields) ──────────────────

const productCreateSchema = joi
  .object({
    name: joi.string().trim().min(2).max(200).required(),
    description: joi.string().trim().allow(""),
    category: objectId.required(),
    subcategory: objectId.optional(),
    brand: objectId.optional(),
    discount: objectId.optional(),

    sku: joi.string().trim().optional(),
    barCode: joi.string().trim().optional(),
    qrCode: joi.string().trim().optional(),

    warrantyInformation: joi.string().trim().default("No warranty info"),
    shippingInformation: joi.string().trim().optional(),
    manufactureCountry: joi.string().trim().optional(),
    availabilityStatus: joi
      .string()
      .valid("In Stock", "Out of Stock", "Preorder")
      .optional(),

    stock: joi.number().min(0).default(0),
    purchasePrice: joi.number().min(0).optional(),
    retailPrice: joi.number().min(0).optional(),
    wholesalePrice: joi.number().min(0).optional(),
    retailProfitMarginByPercentage: joi.number().min(0).max(100).optional(),
    wholesaleProfitMarginPercentage: joi.number().min(0).max(100).optional(),
    alertQuantity: joi.number().min(0).optional(),

    variantType: joi
      .string()
      .valid("singleVariant", "multipleVariant")
      .required(),
    size: joi.string().trim().optional(),
    color: joi.string().trim().optional(),

    weight: joi.number().min(0).optional(),
    dimensions: dimensionsField.optional(),

    groupUnit: joi.string().trim().optional(),
    groupUnitQuantity: joi.number().min(0).optional(),
    unit: joi.string().valid("Piece", "Kg", "Gram", "Packet", "Custom").optional(),

    warehouseLocation: joi.string().trim().optional(),
    tag: joi.array().items(joi.string().trim()).optional(),
    specifications: joi.string().trim().optional(),
    ...seoFieldsSchema,
    seo: seoFields.optional(),
  })
  .options({ abortEarly: false, stripUnknown: { objects: true } });

// ─── Update product schema (everything optional, strict) ─────────────────────

const productUpdateSchema = joi
  .object({
    name: joi.string().trim().min(2).max(200),
    description: joi.string().trim().allow(""),
    category: objectId,
    subcategory: objectId,
    brand: objectId,
    discount: objectId,

    sku: joi.string().trim(),
    barCode: joi.string().trim(),
    qrCode: joi.string().trim(),

    warrantyInformation: joi.string().trim(),
    shippingInformation: joi.string().trim(),
    manufactureCountry: joi.string().trim(),
    availabilityStatus: joi
      .string()
      .valid("In Stock", "Out of Stock", "Preorder"),

    stock: joi.number().min(0),
    purchasePrice: joi.number().min(0),
    retailPrice: joi.number().min(0),
    wholesalePrice: joi.number().min(0),
    retailProfitMarginByPercentage: joi.number().min(0).max(100),
    wholesaleProfitMarginPercentage: joi.number().min(0).max(100),
    alertQuantity: joi.number().min(0),

    variantType: joi.string().valid("singleVariant", "multipleVariant"),
    size: joi.string().trim(),
    color: joi.string().trim(),

    weight: joi.number().min(0),
    dimensions: dimensionsField,

    groupUnit: joi.string().trim(),
    groupUnitQuantity: joi.number().min(0),
    unit: joi.string().valid("Piece", "Kg", "Gram", "Packet", "Custom"),

    warehouseLocation: joi.string().trim(),
    tag: joi.array().items(joi.string().trim()),
    specifications: joi.string().trim(),

    isActive: joi.boolean(),
    ...seoFieldsSchema,
    seo: seoFields,
  })
  .min(1) // at least one field must be present
  .options({ abortEarly: false, stripUnknown: { objects: true } });

// ─── File checks ──────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_GALLERY_IMAGES = 10;

const validateImageFile = (file, label) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new customError(
      `${label} size must be less than 5 MB`,
      statusCodes.BAD_REQUEST,
    );
  }
};

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validate product CREATE request — requires thumbnail, optional gallery + ogImage.
 * Strips unknown fields to prevent mass-assignment.
 */
const validateProduct = async (req) => {
  const expandedBody = expandBracketKeys(req.body);
  const value = await productCreateSchema.validateAsync(expandedBody);

  const thumbnail = req.files?.thumbnail?.[0];
  const images = req.files?.image || [];
  const ogImage = req.files?.ogImage?.[0]; // optional SEO og:image

  if (!thumbnail) {
    throw new customError("Thumbnail is required", statusCodes.BAD_REQUEST);
  }

  validateImageFile(thumbnail, "Thumbnail");
  images.forEach((img, idx) => validateImageFile(img, `Image ${idx + 1}`));
  if (ogImage) validateImageFile(ogImage, "OG Image");

  if (images.length > MAX_GALLERY_IMAGES) {
    throw new customError(
      `You can upload a maximum of ${MAX_GALLERY_IMAGES} gallery images`,
      statusCodes.BAD_REQUEST,
    );
  }

  return { ...value, thumbnail, images, ogImage };
};

/**
 * Validate product UPDATE — all fields optional, strict.
 * Also accepts an optional ogImage file upload.
 */
const validateProductUpdate = async (req) => {
  const expandedBody = expandBracketKeys(req.body);
  const value = await productUpdateSchema.validateAsync(expandedBody);

  const ogImage = req.files?.ogImage?.[0];
  if (ogImage) validateImageFile(ogImage, "OG Image");

  return { ...value, ogImage };
};

/**
 * Validate multiple image uploads (for addProductImage endpoint).
 */
const validateProductGalleryUpload = (req) => {
  const images = req.files?.image || [];
  if (images.length === 0) {
    throw new customError("At least one image file is required", statusCodes.BAD_REQUEST);
  }

  images.forEach((img, idx) => validateImageFile(img, `Image ${idx + 1}`));

  if (images.length > MAX_GALLERY_IMAGES) {
    throw new customError(
      `You can upload a maximum of ${MAX_GALLERY_IMAGES} gallery images at once`,
      statusCodes.BAD_REQUEST,
    );
  }

  return images;
};

module.exports = {
  validateProduct,
  validateProductUpdate,
  validateProductGalleryUpload,
  MAX_GALLERY_IMAGES,
};
