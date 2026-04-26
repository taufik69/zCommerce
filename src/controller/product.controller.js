const crypto = require("crypto");
const Product = require("../models/product.model");
const Review = require("../models/review.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");
const {
  validateProduct,
  validateProductUpdate,
  validateProductImageUpload,
  MAX_GALLERY_IMAGES,
} = require("../validation/product.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

// ─── constants ────────────────────────────────────────────────────────────────

const NS = "product";
const CACHE_TTL = 60 * 60;
const CACHE_TTL_LIST = 60 * 30;

// ─── helpers ──────────────────────────────────────────────────────────────────

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a stable cache suffix from a query object — sorted keys for hit consistency.
 */
const stableSuffix = (obj) => {
  const sorted = Object.keys(obj || {})
    .sort()
    .reduce((acc, k) => {
      if (obj[k] !== undefined && obj[k] !== "") acc[k] = obj[k];
      return acc;
    }, {});
  return JSON.stringify(sorted);
};

/**
 * Generate a collision-safe barcode — Date.now() alone collides under load.
 */
const generateBarcode = () => {
  const ts = Date.now().toString();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${ts.slice(-9)}${rand}`.slice(0, 13);
};

/**
 * Collect every Cloudinary publicId from a product (thumbnail + gallery + ogImage).
 */
const collectProductPublicIds = (product) => {
  const ids = [];
  if (product.thumbnail?.publicId) ids.push(product.thumbnail.publicId);
  if (Array.isArray(product.image)) {
    product.image.forEach((img) => img?.publicId && ids.push(img.publicId));
  }
  if (product.seo?.ogImage?.publicId) ids.push(product.seo.ogImage.publicId);
  return ids;
};

const fireAndForgetCloudinaryDelete = (publicIds = []) => {
  if (!publicIds.length) return;
  setImmediate(() => {
    publicIds.forEach((id) =>
      deleteCloudinaryFile(id).catch((e) =>
        console.error(`[Cloudinary] delete ${id} failed:`, e.message),
      ),
    );
  });
};

// ─── controller class ─────────────────────────────────────────────────────────

class ProductController {
  // ─── CREATE ────────────────────────────────────────────────────────────────
  createProduct = asynchandeler(async (req, res) => {
    const value = await validateProduct(req);
    const { thumbnail, images, ogImage, ...productData } = value;

    // Uniqueness checks (parallel)
    const [skuTaken, barCodeTaken] = await Promise.all([
      productData.sku ? Product.exists({ sku: productData.sku }) : null,
      productData.barCode ? Product.exists({ barCode: productData.barCode }) : null,
    ]);

    if (skuTaken) {
      throw new customError(
        `SKU "${productData.sku}" already exists`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (barCodeTaken) {
      throw new customError(
        `Barcode "${productData.barCode}" already exists`,
        statusCodes.BAD_REQUEST,
      );
    }

    // Build SEO subdoc — merge text fields with ogImage placeholder if uploaded
    const seoData = {
      ...(productData.seo || {}),
      ...(ogImage
        ? { ogImage: { status: "pending", localPath: ogImage.path } }
        : {}),
    };

    const product = await Product.create({
      ...productData,
      barCode: productData.barCode || generateBarcode(),
      thumbnail: { status: "pending", localPath: thumbnail.path },
      image: images.map((img) => ({
        status: "pending",
        localPath: img.path,
      })),
      seo: seoData,
    });

    // Enqueue all uploads in one Redis round-trip
    const jobs = [
      {
        name: "create-product-thumbnail",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: thumbnail.path,
          fieldName: "thumbnail",
        },
      },
      ...images.map((img, i) => ({
        name: "create-product-image",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: img.path,
          fieldName: "image",
          index: i,
        },
      })),
    ];

    if (ogImage) {
      jobs.push({
        name: "create-product-ogimage",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: ogImage.path,
          fieldName: "seo.ogImage",
        },
      });
    }

    await imageQueue.addBulk(jobs);

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Product created. Images are uploading in background.",
      { _id: product._id, slug: product.slug, name: product.name },
    );
  });

  // ─── READ — all (with filters + caching) ───────────────────────────────────
  getAllProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, `all:${stableSuffix(req.query)}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const { category, subcategory, brand, minPrice, maxPrice } = req.query;

    const query = {};
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;

    // Push price filter to the DB instead of in-memory filter
    if (minPrice || maxPrice) {
      const priceCond = {};
      if (minPrice) priceCond.$gte = parseFloat(minPrice);
      if (maxPrice) priceCond.$lte = parseFloat(maxPrice);
      query.retailPrice = priceCond;
    }

    const products = await Product.find(query)
      .populate("category brand discount")
      .populate({ path: "subcategory", populate: "discount" })
      .populate({ path: "variant", select: "variantName retailPrice stockVariant size color image" })
      .sort({ createdAt: -1 })
      .lean();

    if (!products.length) {
      throw new customError("No products found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products },
    );
  });

  // ─── READ — by slug ────────────────────────────────────────────────────────
  getProductBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Product fetched successfully",
        { product: cached, fromCache: true },
      );
    }

    const product = await Product.findOne({ slug })
      .populate("brand discount stockAdjustment")
      .populate({ path: "category", populate: "discount" })
      .populate({ path: "subcategory", populate: "discount" })
      .populate({ path: "variant", populate: "stockVariantAdjust" })
      .populate({ path: "byReturn", populate: "product variant" })
      .populate({ path: "salesReturn", populate: "product variant" })
      .lean();

    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, product, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product fetched successfully",
      { product },
    );
  });

  // ─── UPDATE — text fields + SEO + optional ogImage replacement ─────────────
  updateProductInfoBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const value = await validateProductUpdate(req);
    const { ogImage, ...updateData } = value;

    // Uniqueness checks against OTHER docs (parallel)
    const [skuTaken, barCodeTaken] = await Promise.all([
      updateData.sku
        ? Product.exists({ sku: updateData.sku, slug: { $ne: slug } })
        : null,
      updateData.barCode
        ? Product.exists({ barCode: updateData.barCode, slug: { $ne: slug } })
        : null,
    ]);

    if (skuTaken) {
      throw new customError(
        `SKU "${updateData.sku}" is already taken`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (barCodeTaken) {
      throw new customError(
        `Barcode "${updateData.barCode}" is already taken`,
        statusCodes.BAD_REQUEST,
      );
    }

    // Load doc first if image change is needed (we need oldPublicId)
    let product;
    let oldOgPublicId = null;

    if (ogImage) {
      product = await Product.findOne({ slug });
      if (!product) {
        throw new customError("Product not found", statusCodes.NOT_FOUND);
      }
      oldOgPublicId = product.seo?.ogImage?.publicId || null;
    }

    // Build $set payload — flatten seo so ogImage merges instead of replacing
    const $set = { ...updateData };
    if (updateData.seo) {
      delete $set.seo;
      Object.entries(updateData.seo).forEach(([k, v]) => {
        $set[`seo.${k}`] = v;
      });
    }
    if (ogImage) {
      $set["seo.ogImage"] = {
        status: "pending",
        localPath: ogImage.path,
        url: product.seo?.ogImage?.url || "", // keep old URL visible during upload
        publicId: product.seo?.ogImage?.publicId || "",
        tries: 0,
        lastError: "",
      };
    }

    product = await Product.findOneAndUpdate(
      { slug },
      { $set },
      { new: true, runValidators: true },
    ).populate("category subcategory brand variant discount");

    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    if (ogImage) {
      await imageQueue.add("update-product-ogimage", {
        modelName: NS,
        documentId: product._id,
        localPath: ogImage.path,
        fieldName: "seo.ogImage",
        oldPublicId: oldOgPublicId,
      });
    }

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product updated successfully",
      product,
    );
  });

  // ─── ADD a single gallery image ────────────────────────────────────────────
  addProductImage = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const file = validateProductImageUpload(req);

    const product = await Product.findOne({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    if (product.image.length >= MAX_GALLERY_IMAGES) {
      throw new customError(
        `Gallery already has ${MAX_GALLERY_IMAGES} images (max)`,
        statusCodes.BAD_REQUEST,
      );
    }

    const nextIndex = product.image.length;
    product.image.push({
      status: "pending",
      localPath: file.path,
      tries: 0,
    });

    await product.save();

    await imageQueue.add("add-product-image", {
      modelName: NS,
      documentId: product._id,
      localPath: file.path,
      fieldName: "image",
      index: nextIndex,
    });

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Image upload started in background",
      { slug, index: nextIndex },
    );
  });

  // ─── DELETE a single gallery image (or thumbnail) ──────────────────────────
  deleteProductImage = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      throw new customError("imageUrl is required", statusCodes.BAD_REQUEST);
    }

    const product = await Product.findOne({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const toDelete = [];

    // Match thumbnail
    if (product.thumbnail?.url === imageUrl) {
      if (product.thumbnail.publicId) toDelete.push(product.thumbnail.publicId);
      product.thumbnail = { status: "pending" };
    } else {
      // Match in gallery
      const beforeLen = product.image.length;
      product.image = product.image.filter((img) => {
        if (img.url === imageUrl) {
          if (img.publicId) toDelete.push(img.publicId);
          return false;
        }
        return true;
      });

      if (product.image.length === beforeLen) {
        throw new customError(
          "Image not found in this product",
          statusCodes.NOT_FOUND,
        );
      }
    }

    await product.save();
    await bumpNsVersion(NS);
    fireAndForgetCloudinaryDelete(toDelete);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Image deleted successfully",
      { slug, removed: toDelete.length },
    );
  });

  // ─── PAGINATION ────────────────────────────────────────────────────────────
  getProductsWithPagination = asynchandeler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const cacheKey = await buildCacheKey(NS, `page:${page}:limit:${limit}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const [products, total] = await Promise.all([
      Product.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate("category subcategory brand variant discount")
        .lean(),
      Product.countDocuments(),
    ]);

    if (!products.length) {
      throw new customError("No products found", statusCodes.NOT_FOUND);
    }

    const payload = {
      products,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    await setCache(cacheKey, payload, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      payload,
    );
  });

  // ─── DELETE ────────────────────────────────────────────────────────────────
  deleteProductBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const product = await Product.findOneAndDelete({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    await bumpNsVersion(NS);

    // Cleanup ALL images (thumbnail + gallery + SEO og image)
    fireAndForgetCloudinaryDelete(collectProductPublicIds(product));

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product deleted successfully",
      { slug },
    );
  });

  // ─── REVIEWS ───────────────────────────────────────────────────────────────
  getProductReviewBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const product = await Product.findOne({ slug }).select("_id").lean();
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const reviews = await Review.find({ product: product._id })
      .populate("reviewer", "name email image phone")
      .lean();

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Reviews fetched successfully",
      { reviews },
    );
  });

  updateProductReviewBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const product = await Product.findOne({ slug }).select("_id").lean();
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const review = await Review.create({
      product: product._id,
      reviewer: req.user._id,
      rating: req.body.rating,
      comment: req.body.comment,
    });

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product review added successfully",
      review,
    );
  });

  removeProductReviewBySlug = asynchandeler(async (req, res) => {
    const { id } = req.body;
    if (!id) {
      throw new customError("Review id is required", statusCodes.BAD_REQUEST);
    }

    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      throw new customError("Review not found", statusCodes.NOT_FOUND);
    }

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product review removed successfully",
      null,
    );
  });

  // ─── MULTIPLE-VARIANT PRODUCTS ─────────────────────────────────────────────
  getAllMultipleVariantProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "multiple-variants");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Multiple variant products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const products = await Product.find({ variantType: "multipleVariant" })
      .populate("category subcategory brand variant discount")
      .sort({ createdAt: -1 })
      .lean();

    if (!products.length) {
      throw new customError(
        "Multiple variant products not found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Multiple variant products fetched successfully",
      { products },
    );
  });

  // ─── NEW ARRIVALS ──────────────────────────────────────────────────────────
  getNewArrivalProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "new-arrivals");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "New arrival products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("brand variant discount")
      .populate({ path: "category", populate: "discount" })
      .populate({ path: "subcategory", populate: "discount" })
      .lean();

    if (!products.length) {
      throw new customError(
        "New arrival products not found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "New arrival products fetched successfully",
      { products },
    );
  });

  // ─── PRICE-RANGE FILTER ────────────────────────────────────────────────────
  getProductsByPriceRange = asynchandeler(async (req, res) => {
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);

    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      throw new customError("Invalid price range", statusCodes.BAD_REQUEST);
    }
    if (minPrice > maxPrice) {
      throw new customError(
        "minPrice cannot be greater than maxPrice",
        statusCodes.BAD_REQUEST,
      );
    }

    const cacheKey = await buildCacheKey(NS, `price:${minPrice}-${maxPrice}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const products = await Product.aggregate([
      {
        $lookup: {
          from: "variants",
          localField: "variant",
          foreignField: "_id",
          as: "variantdocs",
        },
      },
      {
        $lookup: {
          from: "discounts",
          localField: "discount",
          foreignField: "_id",
          as: "discountdocs",
        },
      },
      {
        $match: {
          $or: [
            { retailPrice: { $gte: minPrice, $lte: maxPrice } },
            {
              variantdocs: {
                $elemMatch: {
                  retailPrice: { $gte: minPrice, $lte: maxPrice },
                },
              },
            },
          ],
        },
      },
    ]);

    if (!products.length) {
      throw new customError("No products found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products },
    );
  });

  // ─── RELATED PRODUCTS ──────────────────────────────────────────────────────
  getRelatedProducts = asynchandeler(async (req, res) => {
    const { category } = req.body;
    if (!category) {
      throw new customError("category is required", statusCodes.BAD_REQUEST);
    }

    const products = await Product.find({ category, isActive: true })
      .populate("category subcategory brand variant discount")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!products.length) {
      throw new customError(
        "No related products found",
        statusCodes.NOT_FOUND,
      );
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products },
    );
  });

  // ─── DISCOUNTED PRODUCTS (graceful empty handling) ─────────────────────────
  getDiscountProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "discount");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Discounted products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    // Run both queries in parallel — independent
    const [products, variantDiscountedProducts] = await Promise.all([
      Product.find({ discount: { $ne: null } })
        .populate("brand variant discount")
        .populate({ path: "category", populate: "discount" })
        .populate({ path: "subcategory", populate: "discount" })
        .sort({ createdAt: -1 })
        .lean(),
      Variant.find({ discount: { $ne: null } })
        .sort({ createdAt: -1 })
        .populate({
          path: "product",
          populate: [
            { path: "category", populate: "discount" },
            { path: "subcategory", populate: "discount" },
            { path: "brand", populate: "discount" },
          ],
          select: "-variant",
        })
        .lean(),
    ]);

    const merged = [...products, ...variantDiscountedProducts];

    if (!merged.length) {
      throw new customError(
        "No discounted products found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, merged, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounted products fetched successfully",
      { products: merged },
    );
  });

  // ─── BEST-SELLING (graceful empty handling) ────────────────────────────────
  getBestSellingProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "best-selling");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Best selling products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const [products, variantBestSelling] = await Promise.all([
      Product.find({ totalSales: { $gt: 0 } })
        .sort({ totalSales: -1 })
        .limit(10)
        .populate("brand variant discount")
        .populate({ path: "category", populate: "discount" })
        .populate({ path: "subcategory", populate: "discount" })
        .lean(),
      Variant.find({ totalSales: { $gt: 0 } })
        .sort({ totalSales: -1 })
        .limit(50)
        .populate({ path: "product", select: "-variant" })
        .lean(),
    ]);

    const merged = [...products, ...variantBestSelling];

    if (!merged.length) {
      throw new customError(
        "No best selling products found",
        statusCodes.NOT_FOUND,
      );
    }

    await setCache(cacheKey, merged, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Best selling products fetched successfully",
      { products: merged },
    );
  });

  // ─── NAME / BARCODE SEARCH (regex-escaped) ─────────────────────────────────
  getNameWiseSearch = asynchandeler(async (req, res) => {
    const name = String(req.query.name || "").trim();
    const barCode = String(req.query.barCode || "").trim();

    if (!name && !barCode) {
      throw new customError(
        "name or barCode query is required",
        statusCodes.BAD_REQUEST,
      );
    }

    const cacheKey = await buildCacheKey(
      NS,
      `search:${name.toLowerCase()}:${barCode.toLowerCase()}`,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { products: cached, fromCache: true },
      );
    }

    const matchConditions = [];
    if (name) {
      const safe = escapeRegex(name);
      matchConditions.push(
        { name: { $regex: safe, $options: "i" } },
        { "variant.variantName": { $regex: safe, $options: "i" } },
      );
    }
    if (barCode) {
      const safe = escapeRegex(barCode);
      matchConditions.push({ barCode: { $regex: safe, $options: "i" } });
    }

    const products = await Product.aggregate([
      {
        $lookup: {
          from: "variants",
          localField: "variant",
          foreignField: "_id",
          as: "variant",
        },
      },
      {
        $lookup: {
          from: "discounts",
          localField: "discount",
          foreignField: "_id",
          as: "discount",
        },
      },
      { $match: { $or: matchConditions } },
    ]);

    if (!products.length) {
      throw new customError("No products found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, products, 60 * 5); // 5 min — search results change

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products },
    );
  });
}

module.exports = new ProductController();
