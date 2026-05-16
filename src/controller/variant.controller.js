require("dotenv").config();
const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateVariant, validateVariantUpdate } = require("../validation/variant.validation");
const { expandBracketKeys } = require("../utils/parseFormData.util");

const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");

const NS = "variant";
const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_TTL_LIST = 60 * 30; // 30 mins

/**
 * Collect all Cloudinary publicIds from a variant.
 */
const collectVariantPublicIds = (v) => {
  if (!v || !Array.isArray(v.image)) return [];
  return v.image.map((img) => img?.publicId).filter(Boolean);
};

const fireAndForgetCloudinaryDelete = (publicIds = []) => {
  if (!publicIds.length) return;
  setImmediate(() => {
    publicIds.forEach((id) =>
      deleteCloudinaryFile(id).catch((err) =>
        console.error(`[Cleanup] Failed to delete ${id}:`, err.message),
      ),
    );
  });
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

    // 1. Collect Gallery Images
    const currentGalleryFiles = allFiles.filter(
      (f) => f.fieldname === "image" || f.fieldname === `variants[${i}][image]`,
    );
    
    // If they used flat 'image' name, we should only take the one that corresponds to this variant index
    // UNLESS they only sent one variant, then we take all 'image' files for it.
    // However, the best practice is nested naming variants[i][image].
    // If we find nested names, we use those exclusively for this variant.
    const nestedGalleryFiles = allFiles.filter((f) => f.fieldname === `variants[${i}][image]`);
    const finalGalleryFiles = nestedGalleryFiles.length > 0 
      ? nestedGalleryFiles 
      : (allFiles.filter(f => f.fieldname === "image")[i] ? [allFiles.filter(f => f.fieldname === "image")[i]] : []);

    // 2. Collect OG Image
    const nestedOgImage = allFiles.find((f) => f.fieldname === `variants[${i}][ogImage]`);
    const flatOgImage = allFiles.filter(f => f.fieldname === "ogImage")[i];
    const finalOgImage = nestedOgImage || flatOgImage;

    const variantImages = finalGalleryFiles.map(file => ({
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
      image: variantImages,
      seo: seoData,
    });

    await newVariant.save();

    // Attach to product
    await product.findByIdAndUpdate(newVariant.product, {
      $push: { variant: newVariant._id },
    });

    // Enqueue jobs
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
      select:
        "name category brand subcategory discount  barCode sku stock retailPrice wholesalePrice purchasePrice slug",
    })
    .populate("stockVariantAdjust byReturn salesReturn")
    .select("-updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  if (!variants || variants.length === 0) {
    throw new customError("Variants not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, variants, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variants fetched successfully",
    variants ,
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
      select:
        "name category brand subcategory discount  barCode sku stock retailPrice wholesalePrice purchasePrice slug",
    })
    .populate("stockVariantAdjust byReturn salesReturn")
    .lean();

  if (!singleVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, singleVariant, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant fetched successfully",
    singleVariant,
  );
});

// @desc update variant
exports.updateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const allFiles = req.files || [];

  const existingVariant = await variant.findOne({ slug });
  if (!existingVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }

  // Handle new images
  const jobs = [];
  const initialImageCount = existingVariant.image.length;

  const galleryFiles = allFiles.filter((f) => f.fieldname === "image");
  const ogFiles = allFiles.filter((f) => f.fieldname === "ogImage");

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
  const validatedData = await validateVariantUpdate(req.body, allFiles, existingVariant._id);
  Object.assign(existingVariant, validatedData);
  await existingVariant.save();

  if (jobs.length > 0) {
    await imageQueue.addBulk(jobs);
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant updated successfully",
    existingVariant,
  );
});

// @desc deactivate variant
exports.deactivateVariant = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  const variantToDeactivate = await variant.findOne({ slug });
  if (!variantToDeactivate) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }
  variantToDeactivate.isActive = false;
  await variantToDeactivate.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant deactivated successfully",
    variantToDeactivate,
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
    variantToActivate,
  );
});

// @desc delete variant
exports.deleteVariant = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const deletedVariant = await variant.findOneAndDelete({ slug });
  if (!deletedVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }

  // Remove the variant from the product's variants array
  await product.findByIdAndUpdate(deletedVariant.product, {
    $pull: { variant: deletedVariant._id },
  });

  // Background cleanup for Cloudinary
  fireAndForgetCloudinaryDelete(collectVariantPublicIds(deletedVariant));

  await bumpNsVersion(NS);
  await bumpNsVersion("product");

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant deleted successfully",
    deletedVariant,
  );
});
