const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

const Discount = require("../models/discount.model");
const Category = require("../models/category.model");
const Subcategory = require("../models/subcategory.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { validateDiscount, validateDiscountUpdate } = require("../validation/discount.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "discount";
const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_TTL_LIST = 60 * 30; // 30 mins

// @desc create a new discount
exports.createDiscount = asynchandeler(async (req, res) => {
  const value = await validateDiscount(req);

  // create a new discount
  const discount = new Discount(value);

  await discount.save();

  // Optimized Bulk Updates for Products
  if (value.discountPlan === "flat") {
    await Product.updateMany({}, { $set: { discount: discount._id } });
  } else if (value.discountPlan === "category" && value.category) {
    await Product.updateMany(
      { category: value.category },
      { $set: { discount: discount._id } },
    );
    await Category.findByIdAndUpdate(value.category, {
      $set: { discount: discount._id },
    });
  } else if (value.discountPlan === "subCategory" && value.subCategory) {
    await Product.updateMany(
      { subcategory: value.subCategory },
      { $set: { discount: discount._id } },
    );
    await Subcategory.findByIdAndUpdate(value.subCategory, {
      $set: { discount: discount._id },
    });
  } else if (value.discountPlan === "product" && value.product) {
    await Product.findByIdAndUpdate(value.product, {
      $set: { discount: discount._id },
    });
  } else if (value.discountPlan === "variant" && value.variant) {
    await Variant.findByIdAndUpdate(value.variant, {
      $set: { discount: discount._id },
    });
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED || 201,
    "Discount created successfully",
    discount,
  );
});

// @desc get all discounts
exports.getAllDiscounts = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounts fetched successfully",
      { discounts: cached, fromCache: true },
    );
  }

  const discounts = await Discount.find()
    .populate("category subCategory product")
    .sort({ createdAt: -1 })
    .lean();

  if (!discounts || discounts.length === 0) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // serial add করা
  const discountsWithSerial = discounts.map((d, index) => {
    const serialNumber = (index + 1).toString().padStart(6, "0");
    return {
      serial: `DISC-${serialNumber}`, // prefix = DISC-${serialNumber}
      ...d,
    };
  });

  await setCache(cacheKey, discountsWithSerial, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discounts fetched successfully",
    discountsWithSerial,
  );
});

// @desc search discount with the help of slug
exports.getDiscountBySlug = asynchandeler(async (req, res) => {
  const slug = req.params.slug;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discount fetched successfully",
      { discount: cached, fromCache: true },
    );
  }

  const discount = await Discount.findOne({ slug })
    .populate("category subCategory product")
    .lean();

  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, discount, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount fetched successfully",
    discount,
  );
});

// @desc update a discount by slug
exports.updateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const validatedData = await validateDiscountUpdate(req);
  const updates = validatedData;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // If the plan or target (category/product/subCategory) is changing, cleanup old relations first
  const isPlanChanging = updates.discountPlan && updates.discountPlan !== discount.discountPlan;
  const isTargetChanging = 
    (updates.category && updates.category !== discount.category?.toString()) ||
    (updates.subCategory && updates.subCategory !== discount.subCategory?.toString()) ||
    (updates.product && updates.product !== discount.product?.toString());

  if (isPlanChanging || isTargetChanging) {
    // Cleanup OLD relations
    await Product.updateMany({ discount: discount._id }, { $set: { discount: null } });
    if (discount.category) await Category.findByIdAndUpdate(discount.category, { $set: { discount: null } });
    if (discount.subCategory) await Subcategory.findByIdAndUpdate(discount.subCategory, { $set: { discount: null } });
    if (discount.product) await Product.findByIdAndUpdate(discount.product, { $set: { discount: null } });
    if (discount.variant) await Variant.findByIdAndUpdate(discount.variant, { $set: { discount: null } });
  }

  // Update only the fields provided in the request body
  Object.keys(updates).forEach((key) => {
    discount[key] = updates[key];
  });
  
  // Save the updated discount
  await discount.save();

  // Apply NEW relations
  if (discount.discountPlan === "flat") {
    await Product.updateMany({}, { $set: { discount: discount._id } });
  } else if (discount.discountPlan === "category" && discount.category) {
    await Product.updateMany({ category: discount.category }, { $set: { discount: discount._id } });
    await Category.findByIdAndUpdate(discount.category, { $set: { discount: discount._id } });
  } else if (discount.discountPlan === "subCategory" && discount.subCategory) {
    await Product.updateMany({ subcategory: discount.subCategory }, { $set: { discount: discount._id } });
    await Subcategory.findByIdAndUpdate(discount.subCategory, { $set: { discount: discount._id } });
  } else if (discount.discountPlan === "product" && discount.product) {
    await Product.findByIdAndUpdate(discount.product, { $set: { discount: discount._id } });
  } else if (discount.discountPlan === "variant" && discount.variant) {
    await Variant.findByIdAndUpdate(discount.variant, { $set: { discount: discount._id } });
  }

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount updated successfully",
    discount,
  );
});

// @desc deactivate a discount by slug
exports.deactivateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: true });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Deactivate the discount
  discount.isActive = false;
  await discount.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount deactivated successfully",
    discount,
  );
});

//@desc pagination form discount
exports.getDiscountPagination = asynchandeler(async (req, res) => {
  const { limit, page } = req.query;
  const skip = (page - 1) * limit;

  const cacheKey = await buildCacheKey(NS, `page:${page}:limit:${limit}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounts fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  const discounts = await Discount.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("category subCategory product")
    .lean();

  const total = await Discount.countDocuments();
  const totalPages = Math.ceil(total / limit);

  if (!discounts || discounts.length === 0) {
    throw new customError("Discounts not found", statusCodes.NOT_FOUND);
  }

  const result = {
    discounts,
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages: parseInt(totalPages),
  };

  await setCache(cacheKey, result, CACHE_TTL_LIST);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discounts fetched successfully",
    result,
  );
});

// @desc active discount  by slug
exports.activateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: false });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Activate the discount
  discount.isActive = true;
  await discount.save();

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount activated successfully",
    discount,
  );
});

// @desc  permanent delte the discount
exports.deleteDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", statusCodes.NOT_FOUND);
  }

  // Remove discount ID from all related Products, Categories and Subcategories in bulk
  await Product.updateMany(
    { discount: discount._id },
    { $set: { discount: null } },
  );
  await Category.updateMany(
    { discount: discount._id },
    { $set: { discount: null } },
  );
  await Subcategory.updateMany(
    { discount: discount._id },
    { $set: { discount: null } },
  );
  await Variant.updateMany(
    { discount: discount._id },
    { $set: { discount: null } },
  );

  // Now delete the discount document
  await Discount.findByIdAndDelete(discount._id);

  await bumpNsVersion(NS);
  await bumpNsVersion("product");
  await bumpNsVersion("category");
  await bumpNsVersion("subcategory");

  // Send success response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discount deleted successfully",
    discount,
  );
});
