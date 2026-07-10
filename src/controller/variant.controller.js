require("dotenv").config();
const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateVariant,
  validateVariantUpdate,
  validateVariantGalleryUpload,
  MAX_GALLERY_IMAGES,
} = require("../validation/variant.validation");
const { expandBracketKeys } = require("../utils/parseFormData.util");

const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

const NS = "variant";
const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_TTL_LIST = 60 * 30; // 30 mins

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const getVariantUpdateBody = (body = {}) => expandBracketKeys(body);

const getVariantUpdateFiles = (files = [], fieldName) => {
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  return fileList.filter((file) => file.fieldname === fieldName);
};

const collectVariantPublicIds = (v) => {
  if (!v) return [];
  const ids = [];
  if (v.thumbnail?.publicId) ids.push(v.thumbnail.publicId);
  if (Array.isArray(v.image))
    v.image.forEach((img) => img?.publicId && ids.push(img.publicId));
  if (v.seo?.ogImage?.publicId) ids.push(v.seo.ogImage.publicId);
  return ids;
};

// @desc create variant controller (batch)
exports.createVariant = asynchandeler(async (req, res) => {
  const { variants } = expandBracketKeys(req.body);
  const allFiles = req.files || [];

  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    throw new customError(
      "At least one variant is required",
      statusCodes.BAD_REQUEST,
    );
  }

  const savedVariants = [];
  const jobs = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const validatedData = await validateVariant({ ...v, index: i }, allFiles);

    if (
      validatedData.retailProfitMarginByPercentage === null ||
      validatedData.retailProfitMarginByPercentage === undefined
    ) {
      validatedData.retailProfitMarginByPercentage = 0;
    }
    if (
      validatedData.wholesaleProfitMarginPercentage === null ||
      validatedData.wholesaleProfitMarginPercentage === undefined
    ) {
      validatedData.wholesaleProfitMarginPercentage = 0;
    }

    // 1. Collect Thumbnail + Gallery Images
    const nestedThumbnail = allFiles.find(
      (f) => f.fieldname === `variants[${i}][thumbnail]`,
    );
    const flatThumbnail = allFiles.filter((f) => f.fieldname === "thumbnail")[
      i
    ];
    const finalThumbnail = nestedThumbnail || flatThumbnail;

    const nestedGalleryFiles = allFiles.filter(
      (f) => f.fieldname === `variants[${i}][image]`,
    );
    const finalGalleryFiles =
      nestedGalleryFiles.length > 0
        ? nestedGalleryFiles
        : allFiles.filter((f) => f.fieldname === "image")[i]
          ? [allFiles.filter((f) => f.fieldname === "image")[i]]
          : [];

    // 2. Collect OG Image
    const nestedOgImage = allFiles.find(
      (f) => f.fieldname === `variants[${i}][ogImage]`,
    );
    const flatOgImage = allFiles.filter((f) => f.fieldname === "ogImage")[i];
    const finalOgImage = nestedOgImage || flatOgImage;

    const variantImages = finalGalleryFiles.map((file) => ({
      status: "pending",
      localPath: file.path,
      tries: 0,
    }));

    const seoData = validatedData.seo || {};
    if (finalOgImage) {
      seoData.ogImage = {
        status: "pending",
        localPath: finalOgImage.path,
      };
    }

    const newVariant = new variant({
      ...validatedData,
      // Snapshot the creation-time stock — never touched again after this
      initialStock: validatedData.stockVariant,
      thumbnail: finalThumbnail
        ? { status: "pending", localPath: finalThumbnail.path }
        : undefined,
      image: variantImages,
      seo: seoData,
    });

    await newVariant.save();

    // Attach to product
    await product.findByIdAndUpdate(newVariant.product, {
      $push: { variant: newVariant._id },
    });

    // Enqueue jobs
    if (finalThumbnail) {
      jobs.push({
        name: "create-variant-thumbnail",
        data: {
          modelName: NS,
          documentId: newVariant._id,
          localPath: finalThumbnail.path,
          fieldName: "thumbnail",
        },
      });
    }

    finalGalleryFiles.forEach((file, index) => {
      jobs.push({
        name: "add-product-image",
        data: {
          modelName: NS,
          documentId: newVariant._id,
          localPath: file.path,
          fieldName: "image",
          index: index,
        },
      });
    });

    if (finalOgImage) {
      jobs.push({
        name: "add-product-image",
        data: {
          modelName: NS,
          documentId: newVariant._id,
          localPath: finalOgImage.path,
          fieldName: "seo.ogImage",
        },
      });
    }

    savedVariants.push(newVariant);
  }

  if (jobs.length > 0) {
    await imageQueue.addBulk(jobs);
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product"); // Variants affect products

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Variants creation started in background",
    savedVariants,
  );
});

// @desc get all variants
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Variants fetched successfully",
      { variants: cached, fromCache: true },
    );
  }

  const variants = await variant
    .find()
    .populate({
      path: "product",
      populate: ["category", "brand", "subcategory", "discount"],
    })
    .populate("byReturn salesReturn")
    .select("-updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  if (!variants || variants.length === 0) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No variants found", {
      variants: [],
      fromCache: false,
    });
  }

  await setCache(cacheKey, variants, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variants fetched successfully",
    { variants, fromCache: false },
  );
});

// @desc search variants by name or barcode
exports.searchVariants = asynchandeler(async (req, res) => {
  const search = String(req.query.q || req.query.search || "").trim();
  const isActive =
    req.query.isActive === undefined ? null : parseBoolean(req.query.isActive);

  if (!search) {
    throw new customError("Search query is required", statusCodes.BAD_REQUEST);
  }

  if (req.query.isActive !== undefined && isActive === null) {
    throw new customError(
      "isActive must be true or false",
      statusCodes.BAD_REQUEST,
    );
  }

  const cacheKey = await buildCacheKey(
    NS,
    `search:${search.toLowerCase()}:isActive:${isActive}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Variants search results",
      { variants: cached, fromCache: true },
    );
  }

  const safeSearch = escapeRegex(search);
  const searchRegex = new RegExp(safeSearch, "i");
  const filter = {
    $or: [{ variantName: searchRegex }, { barCode: searchRegex }],
  };

  if (isActive !== null) {
    filter.isActive = isActive;
  }

  const variants = await variant
    .find(filter)
    .populate({
      path: "product",
      select:
        "name category brand subcategory discount barCode sku stock retailPrice wholesalePrice purchasePrice slug",
    })
    .populate("byReturn salesReturn")
    .select("-updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  await setCache(cacheKey, variants, 60 * 5);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    variants.length ? "Variants search results" : "No variants found",
    { variants, fromCache: false },
  );
});

// @desc get single variant
exports.getSingleVariant = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Variant fetched successfully",
      { variant: cached, fromCache: true },
    );
  }

  const singleVariant = await variant
    .findOne({ slug })
    .populate({
      path: "product",
      populate: ["category", "brand", "subcategory", "discount"],
      select:
        "name category brand subcategory discount  barCode sku stock retailPrice wholesalePrice purchasePrice slug",
    })
    .populate("byReturn salesReturn")
    .lean();

  if (!singleVariant) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variant not found", {
      variant: null,
      fromCache: false,
    });
  }

  await setCache(cacheKey, singleVariant, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant fetched successfully",
    { variant: singleVariant, fromCache: false },
  );
});

// @desc update variant
exports.updateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const allFiles = req.files || [];
  const updateBody = getVariantUpdateBody(req.body);

  const existingVariant = await variant.findOne({ slug });
  if (!existingVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }

  // Handle new images
  const jobs = [];
  const initialImageCount = existingVariant.image.length;
  const previousProductId = existingVariant.product?.toString();

  const galleryFiles = getVariantUpdateFiles(allFiles, "image");
  const thumbnailFiles = getVariantUpdateFiles(allFiles, "thumbnail");
  const ogFiles = getVariantUpdateFiles(allFiles, "ogImage");

  if (thumbnailFiles.length > 0) {
    const thumbnailFile = thumbnailFiles[0];
    const oldPublicId = existingVariant.thumbnail?.publicId || null;

    existingVariant.thumbnail = {
      status: "pending",
      localPath: thumbnailFile.path,
      url: existingVariant.thumbnail?.url || "",
      publicId: existingVariant.thumbnail?.publicId || "",
      tries: 0,
      lastError: "",
    };

    jobs.push({
      name: "update-variant-thumbnail",
      data: {
        modelName: NS,
        documentId: existingVariant._id,
        localPath: thumbnailFile.path,
        fieldName: "thumbnail",
        oldPublicId,
      },
    });
  }

  if (galleryFiles.length > 0) {
    const newImages = galleryFiles.map((file) => ({
      status: "pending",
      localPath: file.path,
      tries: 0,
    }));
    existingVariant.image.push(...newImages);

    galleryFiles.forEach((file, i) => {
      jobs.push({
        name: "add-product-image",
        data: {
          modelName: NS,
          documentId: existingVariant._id,
          localPath: file.path,
          fieldName: "image",
          index: initialImageCount + i,
        },
      });
    });
  }

  if (ogFiles.length > 0) {
    const ogFile = ogFiles[0];
    const oldPublicId = existingVariant.seo?.ogImage?.publicId || null;

    if (!existingVariant.seo) existingVariant.seo = {};
    existingVariant.seo.ogImage = {
      status: "pending",
      localPath: ogFile.path,
      publicId: oldPublicId,
    };

    jobs.push({
      name: "update-product-ogimage", // Or similar job name for ogImage replacement
      data: {
        modelName: NS,
        documentId: existingVariant._id,
        localPath: ogFile.path,
        fieldName: "seo.ogImage",
        oldPublicId,
      },
    });
  }

  // Update other fields
  const validatedData = await validateVariantUpdate(
    updateBody,
    allFiles,
    existingVariant._id,
  );
  if (validatedData.retailProfitMarginByPercentage === null) {
    validatedData.retailProfitMarginByPercentage = 0;
  }
  if (validatedData.wholesaleProfitMarginPercentage === null) {
    validatedData.wholesaleProfitMarginPercentage = 0;
  }
  // "stockVariant" on the update form only updates initialStock (a snapshot)
  // — the live stockVariant counter is exclusively maintained by
  // sales/purchase/adjustment/return controllers and must never be
  // overwritten by an edit form.
  const { stockVariant: submittedStockVariant, ...restValidatedData } =
    validatedData;
  if (submittedStockVariant !== undefined) {
    restValidatedData.initialStock = submittedStockVariant;
  }
  Object.assign(existingVariant, restValidatedData);
  await existingVariant.save();

  const nextProductId = existingVariant.product?.toString();
  if (validatedData.product && previousProductId !== nextProductId) {
    if (previousProductId) {
      await product.findByIdAndUpdate(previousProductId, {
        $pull: { variant: existingVariant._id },
      });
    }

    await product.findByIdAndUpdate(nextProductId, {
      $addToSet: { variant: existingVariant._id },
    });
  }

  if (jobs.length > 0) {
    await imageQueue.addBulk(jobs);
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant updated successfully",
    { variant: existingVariant, fromCache: false },
  );
});

// @desc add gallery image(s) to a variant
exports.addVariantImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const images = validateVariantGalleryUpload(req);

  const variantToUpdate = await variant.findOne({ slug });
  if (!variantToUpdate) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variant not found", {
      variant: null,
    });
  }

  const currentCount = variantToUpdate.image.length;
  if (currentCount + images.length > MAX_GALLERY_IMAGES) {
    throw new customError(
      `Adding ${images.length} images would exceed gallery limit (${MAX_GALLERY_IMAGES}). Current: ${currentCount}`,
      statusCodes.BAD_REQUEST,
    );
  }

  const newImages = images.map((file) => ({
    status: "pending",
    localPath: file.path,
    tries: 0,
  }));
  variantToUpdate.image.push(...newImages);
  await variantToUpdate.save();

  const jobs = images.map((file, i) => ({
    name: "add-product-image",
    data: {
      modelName: NS,
      documentId: variantToUpdate._id,
      localPath: file.path,
      fieldName: "image",
      index: currentCount + i,
    },
  }));

  await imageQueue.addBulk(jobs);
  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    `${images.length} image(s) upload started in background`,
    { slug, count: images.length },
  );
});

// @desc delete variant gallery image(s) or thumbnail by publicId
exports.deleteVariantImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  let { publicId } = req.body;

  if (!publicId) {
    throw new customError("publicId is required", statusCodes.BAD_REQUEST);
  }

  if (!Array.isArray(publicId)) {
    publicId = [publicId];
  }

  const variantToUpdate = await variant.findOne({ slug });
  if (!variantToUpdate) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variant not found", {
      variant: null,
    });
  }

  const toDelete = [];

  if (publicId.includes(variantToUpdate.thumbnail?.publicId)) {
    toDelete.push(variantToUpdate.thumbnail.publicId);
    variantToUpdate.thumbnail = { status: "pending" };
  }

  variantToUpdate.image = variantToUpdate.image.filter((img) => {
    if (publicId.includes(img.publicId)) {
      toDelete.push(img.publicId);
      return false;
    }
    return true;
  });

  if (toDelete.length === 0) {
    throw new customError(
      "No matching images found with provided publicIds",
      statusCodes.NOT_FOUND,
    );
  }

  await variantToUpdate.save();
  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  const jobs = toDelete.map((pid) => ({
    name: "delete-cloudinary-image",
    data: { publicId: pid },
  }));

  await imageQueue.addBulk(jobs);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    `${toDelete.length} image(s) removal started in background`,
    { slug, deletedCount: toDelete.length },
  );
});

// @desc deactivate variant
exports.deactivateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToDeactivate = await variant.findOne({ slug });
  if (!variantToDeactivate) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variant not found", {
      variant: null,
      fromCache: false,
    });
  }
  variantToDeactivate.isActive = false;
  await variantToDeactivate.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant deactivated successfully",
    { variant: variantToDeactivate, fromCache: false },
  );
});

// @desc activate Variant
exports.activateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToActivate = await variant.findOne({ slug });
  if (!variantToActivate) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }
  variantToActivate.isActive = true;
  await variantToActivate.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant activated successfully",
    { variant: variantToActivate, fromCache: false },
  );
});

// @desc delete variant
exports.deleteVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const deletedVariant = await variant.findOneAndDelete({ slug });
  if (!deletedVariant) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variant not found", {
      variant: null,
      fromCache: false,
    });
  }

  // Remove the variant from the product's variants array
  await product.findByIdAndUpdate(deletedVariant.product, {
    $pull: { variant: deletedVariant._id },
  });

  const publicIds = collectVariantPublicIds(deletedVariant);
  if (publicIds.length > 0) {
    await imageQueue.addBulk(
      publicIds.map((publicId) => ({
        name: "delete-cloudinary-image",
        data: { publicId },
      })),
    );
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  apiResponse.sendSuccess(res, statusCodes.OK, "Variant deleted successfully", {
    variant: deletedVariant,
    fromCache: false,
  });
});
