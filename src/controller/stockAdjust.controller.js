const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const StockAdjust = require("../models/stockadjust.model");
const { statusCodes } = require("../constant/constant");
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");

const NS = "stock";
const CACHE_TTL = 60 * 30; // 30 minutes

// Swallow Redis errors so a cache miss never breaks the response
const safeGet  = async (key) =>           { try { return key ? await getCache(key) : null; } catch { return null; } };
const safeSet  = async (key, val, ttl) => { try { if (key) await setCache(key, val, ttl); } catch {} };
const safeKey  = async (ns, suffix) =>    { try { return await buildCacheKey(ns, suffix); } catch { return null; } };
const safeBump = async (ns) =>            { try { await bumpNsVersion(ns);                } catch {} };

//@desc create stock adjust
//@route POST /api/stock-adjust
//@access Private
exports.createStockAdjust = asynchandeler(async (req, res) => {
  const {
    variantId,
    productId,
    adjustReason,
    increaseQuantity,
    decreaseQuantity,
    date,
  } = req.body;

  if (!variantId && !productId) {
    throw new customError(
      "Please provide either productId or variantId",
      statusCodes.BAD_REQUEST,
    );
  }

  if (!adjustReason) {
    throw new customError(
      "Please provide all required fields",
      statusCodes.BAD_REQUEST,
    );
  }

  const stockAdjust = await StockAdjust.create({
    productId: productId || null,
    variantId: variantId || null,
    adjustReason,
    increaseQuantity,
    decreaseQuantity,
    date,
  });
  //   update product stock
  if (productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }
    product.stock += increaseQuantity - decreaseQuantity;
    product.stockAdjustment.push(stockAdjust._id);
    await product.save();
  }
  //    update variant stock
  if (variantId) {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new customError("Variant not found", statusCodes.NOT_FOUND);
    }
    variant.stockVariant += increaseQuantity - decreaseQuantity;
    variant.stockVariantAdjust.push(stockAdjust._id);
    await variant.save();
  }

  await safeBump(NS);
  await safeBump("product");

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Stock adjustment created successfully",
    stockAdjust,
  );
});

// @des view all product latest stock
exports.getAllStockAdjusts = asynchandeler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  const q     = String(req.query.q || "").trim();

  // When a search query is present, filter by barcode or product/variant name
  // using an aggregation pipeline so we can match on joined fields.
  if (q) {
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const qRegex = new RegExp(escapeRegex(q), "i");

    const pipeline = [
      // join product
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "_product",
        },
      },
      { $unwind: { path: "$_product", preserveNullAndEmptyArrays: true } },
      // join variant
      {
        $lookup: {
          from: "variants",
          localField: "variantId",
          foreignField: "_id",
          as: "_variant",
        },
      },
      { $unwind: { path: "$_variant", preserveNullAndEmptyArrays: true } },
      // filter: barcode or name match on either product or variant
      {
        $match: {
          $or: [
            { "_product.name":    qRegex },
            { "_product.barCode": qRegex },
            { "_variant.variantName": qRegex },
            { "_variant.barCode":     qRegex },
            { "_variant.sku":         qRegex },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      // total count facet
      {
        $facet: {
          data:  [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await StockAdjust.aggregate(pipeline);
    const rawIds   = (result?.data ?? []).map((d) => d._id);
    const total    = result?.total?.[0]?.count ?? 0;

    // Re-fetch with full populate using the filtered _ids (preserves lean populate DX)
    const stockAdjusts = await StockAdjust.find({ _id: { $in: rawIds } })
      .populate({
        path: "productId",
        populate: { path: "subcategory" },
        select: "name barCode sku size color stock subcategory",
      })
      .populate({
        path: "variantId",
        populate: { path: "product", select: "name subcategory", populate: { path: "subcategory", select: "name" } },
        select: "variantName barCode sku size color stockVariant",
      })
      .sort({ createdAt: -1 })
      .lean();

    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustments retrieved successfully", {
      stockAdjusts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fromCache: false,
    });
  }

  // No search — plain paginated fetch with cache
  const cacheKey = await safeKey(NS, `adjusts:p${page}:l${limit}`);
  const cached   = await safeGet(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustments retrieved successfully", {
      ...cached,
      fromCache: true,
    });
  }

  const [stockAdjusts, total] = await Promise.all([
    StockAdjust.find()
      .populate({
        path: "productId",
        populate: { path: "subcategory", select: "name" },
        select: "name barCode sku size color stock subcategory",
      })
      .populate({
        path: "variantId",
        populate: { path: "product", select: "name subcategory", populate: { path: "subcategory", select: "name" } },
        select: "variantName barCode sku size color stockVariant",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockAdjust.countDocuments(),
  ]);

  const payload = {
    stockAdjusts: stockAdjusts ?? [],
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  await safeSet(cacheKey, payload, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK,
    stockAdjusts.length ? "Stock adjustments retrieved successfully" : "Stock adjustments not found",
    { ...payload, fromCache: false },
  );
});

// @desc get all product category wise

exports.getAllProductCategoryWise = asynchandeler(async (req, res) => {
  const { category } = req.params;
  if (!category)
    throw new customError("Category is required", statusCodes.BAD_REQUEST);

  const cacheKey = await safeKey(NS, `cat:${category}`);
  const cached   = await safeGet(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", cached);

  const products = await Product.find({ category }).populate(
    "stockAdjustment category subcategory brand variant",
  );
  await safeSet(cacheKey, products, CACHE_TTL);
  apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", products);
});

exports.getAllProductSSubcategoryWise = asynchandeler(async (req, res) => {
  const { subcategory } = req.params;
  if (!subcategory)
    throw new customError("Subcategory is required", statusCodes.BAD_REQUEST);

  const cacheKey = await safeKey(NS, `subcat:${subcategory}`);
  const cached   = await safeGet(cacheKey);
  if (cached) return apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", cached);

  const products = await Product.find({ subcategory }).populate(
    "stockAdjustment category subcategory brand variant",
  );
  if (!products || products.length === 0)
    throw new customError("Products not found", statusCodes.NOT_FOUND);
  await safeSet(cacheKey, products, CACHE_TTL);
  apiResponse.sendSuccess(res, statusCodes.OK, "Products retrieved successfully", products);
});

// @desc get all variant
exports.getAllVariants = asynchandeler(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "100", 10)));
  const skip  = (page - 1) * limit;

  const cacheKey = await safeKey(NS, `variants:p${page}:l${limit}`);
  const cached   = await safeGet(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Variants fetched successfully", {
      ...cached,
      fromCache: true,
    });
  }

  // Run both queries + counts in parallel
  const [variants, singleProducts, totalVariants, totalSingle] = await Promise.all([
    Variant.find()
      .populate({ path: "product", populate: [{ path: "category", select: "name _id" }, { path: "subcategory", select: "name _id" }, { path: "brand", select: "name _id" }] })
      .select("variantName barCode sku size color stockVariant product")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.find({ variantType: "singleVariant" })
      .populate("category", "name _id")
      .populate("subcategory", "name _id")
      .populate("brand", "name _id")
      .select("name barCode sku size color stock category subcategory brand")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Variant.countDocuments(),
    Product.countDocuments({ variantType: "singleVariant" }),
  ]);

  const total      = totalVariants + totalSingle;
  const totalPages = Math.ceil(total / limit);

  const payload = { variants, singleProducts, total, totalPages, page, limit };
  await safeSet(cacheKey, payload, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Variants fetched successfully", {
    ...payload,
    fromCache: false,
  });
});

//@desc  get all single varinat product
exports.getSingleVariant = asynchandeler(async (req, res) => {
  const singleVariant = await Product.findOne({ variantType: "singleVariant" });

  if (!singleVariant) {
    throw new customError("Variant not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Variant fetched successfully",
    singleVariant,
  );
});

//@desc delete stockadust by id  en delete en product stock decrease
exports.deleteStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError(
      "Stock adjustment ID is required",
      statusCodes.BAD_REQUEST,
    );

  const stockAdjust = await StockAdjust.findById(id);
  if (!stockAdjust)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  // Reverse the stock change on the source document before deleting
  const { productId, variantId, decreaseQuantity, increaseQuantity } =
    stockAdjust;
  if (productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }
    product.stock -= (increaseQuantity || 0) - (decreaseQuantity || 0);
    product.stockAdjustment.pull(stockAdjust._id);
    await product.save();
  }
  if (variantId) {
    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new customError("Variant not found", statusCodes.NOT_FOUND);
    }
    variant.stockVariant -= (increaseQuantity || 0) - (decreaseQuantity || 0);
    variant.stockVariantAdjust.pull(stockAdjust._id);
    await variant.save();
  }

  await StockAdjust.findByIdAndDelete(id);
  await safeBump(NS);
  await safeBump("product");

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Stock adjustment deleted successfully",
    { id },
  );
});

//@desc  get single stock adjustment by id — full populate for view modal
exports.getStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError("Stock adjustment ID is required", statusCodes.BAD_REQUEST);

  const stockAdjust = await StockAdjust.findById(id)
    .populate({
      path: "productId",
      populate: { path: "category subcategory brand", select: "name" },
      select: "name barCode sku size color stock groupUnit groupUnitQuantity unit purchasePrice retailPrice wholesalePrice subcategory category brand thumbnail",
    })
    .populate({
      path: "variantId",
      populate: {
        path: "product",
        select: "name subcategory category brand thumbnail",
        populate: { path: "subcategory category brand", select: "name" },
      },
      select: "variantName barCode sku size color stockVariant purchasePrice retailPrice wholesalePrice thumbnail",
    })
    .lean();

  if (!stockAdjust)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment retrieved", { stockAdjust });
});

//@desc  update stock adjustment (reason, date, quantities) and re-apply stock delta
exports.updateStockAdjustById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id)
    throw new customError("Stock adjustment ID is required", statusCodes.BAD_REQUEST);

  const existing = await StockAdjust.findById(id);
  if (!existing)
    throw new customError("Stock adjustment not found", statusCodes.NOT_FOUND);

  const {
    increaseQuantity: newInc,
    decreaseQuantity: newDec,
    adjustReason,
    date,
  } = req.body;

  const oldInc = existing.increaseQuantity || 0;
  const oldDec = existing.decreaseQuantity || 0;
  const oldDelta = oldInc - oldDec;

  const resolvedInc = newInc != null ? Number(newInc) : oldInc;
  const resolvedDec = newDec != null ? Number(newDec) : oldDec;
  const newDelta = resolvedInc - resolvedDec;

  const stockDiff = newDelta - oldDelta; // net change to apply on top of existing

  // Adjust stock on the affected document
  if (stockDiff !== 0) {
    if (existing.productId) {
      const product = await Product.findById(existing.productId);
      if (!product) throw new customError("Product not found", statusCodes.NOT_FOUND);
      product.stock += stockDiff;
      await product.save();
    }
    if (existing.variantId) {
      const variant = await Variant.findById(existing.variantId);
      if (!variant) throw new customError("Variant not found", statusCodes.NOT_FOUND);
      variant.stockVariant += stockDiff;
      await variant.save();
    }
  }

  existing.increaseQuantity = resolvedInc || null;
  existing.decreaseQuantity = resolvedDec || null;
  if (adjustReason !== undefined) existing.adjustReason = adjustReason;
  if (date !== undefined) existing.date = date;
  await existing.save();

  await safeBump(NS);
  await safeBump("product");

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustment updated successfully", { stockAdjust: existing });
});
