const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCoupon } = require("../validation/coupon.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const { logAudit } = require("@/service/audit.service");

const NS = "coupon";
const CACHE_TTL = 60 * 60; // 1 hour

// Create coupon
exports.createCoupon = asynchandeler(async (req, res, next) => {
  const validatedData = await validateCoupon(req, res, next);

  // Check if coupon with this code already exists
  const existing = await Coupon.findOne({ code: validatedData.code.toUpperCase() });
  if (existing) {
    throw new customError("Coupon code already exists", statusCodes.BAD_REQUEST);
  }

  const coupon = await Coupon.create(validatedData);

  await bumpNsVersion(NS);

  logAudit({
    req,
    action: "CREATE",
    entityType: "coupon",
    entityId: coupon._id,
    entityLabel: coupon.code,
    after: coupon,
  });

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Coupon created successfully",
    { coupon },
  );
});

// Search coupon using slug
exports.searchCoupon = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  if (!slug) throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Coupon found", {
      coupon: cached,
      fromCache: true,
    });
  }

  const coupon = await Coupon.findOne({ slug }).lean();
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  await setCache(cacheKey, coupon, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon found", { coupon });
});

// Update coupon
exports.updateCoupon = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  if (!slug) throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const validatedData = await validateCoupon(req, res, next);

  const coupon = await Coupon.findOne({ slug });
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  const beforeCoupon = coupon.toObject();

  // Update fields
  Object.assign(coupon, validatedData);

  await coupon.save();
  await bumpNsVersion(NS);

  logAudit({
    req,
    action: "UPDATE",
    entityType: "coupon",
    entityId: coupon._id,
    entityLabel: coupon.code,
    before: beforeCoupon,
    after: coupon,
  });

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon updated successfully", { coupon });
});

// Delete coupon
exports.deleteCoupon = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  if (!slug) throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const coupon = await Coupon.findOneAndDelete({ slug });
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  await bumpNsVersion(NS);

  logAudit({
    req,
    action: "DELETE",
    entityType: "coupon",
    entityId: coupon._id,
    entityLabel: coupon.code,
    before: coupon,
  });

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon deleted successfully", { coupon });
});

// Activate coupon
exports.activateCoupon = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const coupon = await Coupon.findOneAndUpdate(
    { slug },
    { isActive: true },
    { new: false },
  );

  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  await bumpNsVersion(NS);

  logAudit({
    req,
    action: "STATUS_CHANGE",
    entityType: "coupon",
    entityId: coupon._id,
    entityLabel: coupon.code,
    before: { isActive: coupon.isActive },
    after: { isActive: true },
  });
  coupon.isActive = true;

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon activated successfully", { coupon });
});

// Deactivate coupon
exports.deactivateCoupon = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const coupon = await Coupon.findOneAndUpdate(
    { slug },
    { isActive: false },
    { new: false },
  );

  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  await bumpNsVersion(NS);

  logAudit({
    req,
    action: "STATUS_CHANGE",
    entityType: "coupon",
    entityId: coupon._id,
    entityLabel: coupon.code,
    before: { isActive: coupon.isActive },
    after: { isActive: false },
  });
  coupon.isActive = false;

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon deactivated successfully", { coupon });
});

// Get all coupons
exports.getAllCoupons = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Coupons fetched successfully",
      { coupons: cached, fromCache: true }
    );
  }

  const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
  if (!coupons || coupons.length === 0)
    throw new customError("No coupons found", statusCodes.NOT_FOUND);

  await setCache(cacheKey, coupons, CACHE_TTL);

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupons fetched successfully", {
    coupons,
  });
});

/**
 * Check if a coupon is valid for a given amount and return discount details
 * GET /api/v1/coupon/check-validity?code=SAVE20&amount=1000&items=[...]
 */
exports.checkCouponValidity = asynchandeler(async (req, res) => {
  const { code, amount, items } = req.query;

  if (!code || !amount) {
    throw new customError(
      "Coupon code and order amount are required",
      statusCodes.BAD_REQUEST,
    );
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    throw new customError(
      "Invalid or inactive coupon code",
      statusCodes.NOT_FOUND,
    );
  }

  // Check date range
  const now = new Date();
  if (now < coupon.couponStartAt) {
    throw new customError(
      "This coupon is not active yet",
      statusCodes.BAD_REQUEST,
    );
  }
  if (now > coupon.expireAt) {
    throw new customError("This coupon has expired", statusCodes.BAD_REQUEST);
  }

  // Check usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new customError("Coupon usage limit reached", statusCodes.BAD_REQUEST);
  }

  // Check minimum order amount
  if (Number(amount) < coupon.minOrderAmount) {
    throw new customError(
      `Minimum order amount for this coupon is ${coupon.minOrderAmount}`,
      statusCodes.BAD_REQUEST,
    );
  }

  // Check scope constraints (if items are provided)
  // items should be an array of objects: { productId, variantId, categoryId, subCategoryId, brandId }
  if (items) {
    let parsedItems = [];
    try {
      parsedItems = typeof items === "string" ? JSON.parse(items) : items;
    } catch (e) {
      throw new customError("Invalid items format", statusCodes.BAD_REQUEST);
    }

    const hasRestrictedScope =
      (coupon.applicableProducts?.length > 0) ||
      (coupon.applicableCategories?.length > 0) ||
      (coupon.applicableSubCategories?.length > 0) ||
      (coupon.applicableBrands?.length > 0) ||
      (coupon.applicableVariants?.length > 0);

    if (hasRestrictedScope) {
      const isApplicable = parsedItems.some((item) => {
        return (
          (coupon.applicableProducts?.includes(item.productId)) ||
          (coupon.applicableCategories?.includes(item.categoryId)) ||
          (coupon.applicableSubCategories?.includes(item.subCategoryId)) ||
          (coupon.applicableBrands?.includes(item.brandId)) ||
          (coupon.applicableVariants?.includes(item.variantId))
        );
      });

      if (!isApplicable) {
        throw new customError(
          "This coupon is not applicable to any items in your cart",
          statusCodes.BAD_REQUEST,
        );
      }
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = (Number(amount) * coupon.discountValue) / 100;
    if (
      coupon.maxDiscountAmount !== null &&
      discount > coupon.maxDiscountAmount
    ) {
      discount = coupon.maxDiscountAmount;
    }
  } else {
    discount = coupon.discountValue;
  }

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon is valid", {
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: discount,
      finalAmount: Math.max(0, Number(amount) - discount),
    },
  });
});
