const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const SizeChart = require("../models/sizeChart.model");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

// ─── constants ────────────────────────────────────────────────────────────────

const NS = "sizechart";
const CACHE_TTL = 60 * 60;       // 1 hour — single doc
const CACHE_TTL_LIST = 60 * 30;  // 30 min — list / search

// Fields the API never accepts as input — derived by model hooks or system
const READ_ONLY_FIELDS = [
  "slug",
  "sizeLabels",
  "minSize",
  "maxSize",
  "viewCount",
  "childCharts",
  "parentChartId",
  "createdAt",
  "updatedAt",
  "_id",
  "__v",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

const stripReadOnly = (body = {}) => {
  const clean = { ...body };
  READ_ONLY_FIELDS.forEach((f) => delete clean[f]);
  return clean;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── controllers ──────────────────────────────────────────────────────────────

// @desc    Create a new size chart
// @route   POST /sizechart/create-sizechart
exports.createSizeChart = asynchandeler(async (req, res) => {
  const body = stripReadOnly(req.body);

  // createdBy set when auth is active
  if (req.user?._id) body.createdBy = req.user._id;

  const sizeChart = await new SizeChart(body).save();

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Size chart created successfully",
    { sizeChart },
  );
});

// @desc    Get all size charts with optional filters
// @route   GET /sizechart/get-sizechart
// @query   applicableLevel | visibility | isActive | isTemplateChart
exports.getAllSizeChart = asynchandeler(async (req, res) => {
  const { applicableLevel, visibility, isActive, isTemplateChart } = req.query;

  // Build a stable cache key from the active filters
  const filterKey = JSON.stringify({ applicableLevel, visibility, isActive, isTemplateChart });
  const cacheKey = await buildCacheKey(NS, `list:${filterKey}`);
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Size charts fetched successfully", {
      sizeCharts: cached.sizeCharts,
      total: cached.total,
      fromCache: true,
    });
  }

  const query = {};

  if (applicableLevel) query.applicableLevel = applicableLevel;
  if (visibility) query.visibility = visibility;
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (isTemplateChart !== undefined) query.isTemplateChart = isTemplateChart === "true";

  const sizeCharts = await SizeChart.find(query).sort({ displayOrder: 1, createdAt: -1 }).lean();

  if (!sizeCharts.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No size charts found", {
      sizeCharts: [],
      total: 0,
      fromCache: false,
    });
  }

  await setCache(cacheKey, { sizeCharts, total: sizeCharts.length }, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size charts fetched successfully", {
    sizeCharts,
    total: sizeCharts.length,
    fromCache: false,
  });
});

// @desc    Get a single size chart by slug
// @route   GET /sizechart/get-sizechart/:slug
exports.getSizeChartBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const cacheKey = await buildCacheKey(NS, `single:${slug}`);
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart fetched successfully", {
      sizeChart: cached,
      fromCache: true,
    });
  }

  const sizeChart = await SizeChart.findOne({ slug });

  if (!sizeChart) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart not found", {
      sizeChart: null,
      fromCache: false,
    });
  }

  // Increment viewCount atomically — non-blocking, does not affect response
  sizeChart.incrementViewCount().catch(() => {});

  await setCache(cacheKey, sizeChart.toObject(), CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart fetched successfully", {
    sizeChart,
    fromCache: false,
  });
});

// @desc    Update a size chart by slug
// @route   PUT /sizechart/update-sizechart/:slug
exports.updateSizeChart = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const body = stripReadOnly(req.body);

  const sizeChart = await SizeChart.findOne({ slug });

  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  // Merge incoming fields onto the document so pre-save hooks re-run
  Object.assign(sizeChart, body);

  if (req.user?._id) sizeChart.updatedBy = req.user._id;

  // .save() triggers all pre-save hooks:
  //   slug regen, row/column alignment, sizeLabels, sort, applicable validation
  const updated = await sizeChart.save();

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart updated successfully", {
    sizeChart: updated,
  });
});

// @desc    Delete a size chart by slug
// @route   DELETE /sizechart/delete-sizechart/:slug
exports.deleteSizeChart = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const sizeChart = await SizeChart.findOneAndDelete({ slug });

  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart deleted successfully", null);
});

// @desc    Activate a size chart
// @route   PUT /sizechart/update-sizechart/:slug/activate
exports.activateSizeChart = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const sizeChart = await SizeChart.findOneAndUpdate(
    { slug },
    { isActive: true },
    { new: true },
  );

  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart activated successfully", {
    sizeChart,
  });
});

// @desc    Deactivate a size chart
// @route   PUT /sizechart/update-sizechart/:slug/deactivate
exports.deactivateSizeChart = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const sizeChart = await SizeChart.findOneAndUpdate(
    { slug },
    { isActive: false },
    { new: true },
  );

  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Size chart deactivated successfully", {
    sizeChart,
  });
});

// @desc    Create a new size chart from an existing template
// @route   POST /sizechart/from-template
exports.createFromTemplate = asynchandeler(async (req, res) => {
  const { templateId, name, applicableLevel, visibility, description, createdBy, ...rest } = req.body;

  if (!templateId) {
    throw new customError("templateId is required", statusCodes.BAD_REQUEST);
  }
  if (!name) {
    throw new customError("name is required", statusCodes.BAD_REQUEST);
  }

  const sizeChart = await SizeChart.createFromTemplate(templateId, {
    name,
    applicableLevel,
    visibility,
    description,
    createdBy: req.user?._id || createdBy,
    ...rest,
  });

  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Size chart created from template successfully",
    { sizeChart },
  );
});

// @desc    Get applicable size charts for a storefront entity
// @route   GET /sizechart/applicable
// @query   categoryId | subCategoryId | productId | variantId | brandId
exports.getApplicableCharts = asynchandeler(async (req, res) => {
  const { categoryId, subCategoryId, productId, variantId, brandId } = req.query;

  const hasFilter = categoryId || subCategoryId || productId || variantId || brandId;
  if (!hasFilter) {
    throw new customError(
      "At least one filter param is required (categoryId, subCategoryId, productId, variantId, brandId)",
      statusCodes.BAD_REQUEST,
    );
  }

  const filterKey = JSON.stringify(req.query);
  const cacheKey = await buildCacheKey(NS, `applicable:${filterKey}`);
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Applicable size charts fetched successfully", {
      sizeCharts: cached,
      total: cached.length,
      fromCache: true,
    });
  }

  const sizeCharts = await SizeChart.getApplicableCharts({
    categoryId,
    subCategoryId,
    productId,
    variantId,
    brandId,
  });

  await setCache(cacheKey, sizeCharts, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Applicable size charts fetched successfully", {
    sizeCharts,
    total: sizeCharts.length,
    fromCache: false,
  });
});

// @desc    Search size charts by name or applicableLevel keyword
// @route   GET /sizechart/search-sizechart?query=<term>
exports.searchSizeChart = asynchandeler(async (req, res) => {
  const { query } = req.query;

  if (!query || !query.trim()) {
    throw new customError("query param is required", statusCodes.BAD_REQUEST);
  }

  const LEVEL_VALUES = ["category", "subCategory", "product", "variant", "brand"];
  const term = query.trim().toLowerCase();

  const cacheKey = await buildCacheKey(NS, `search:${term}`);
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Search results fetched successfully", {
      sizeCharts: cached,
      total: cached.length,
      fromCache: true,
    });
  }

  const orConditions = [
    { name: { $regex: escapeRegex(query.trim()), $options: "i" } },
  ];

  // If the term exactly matches a level value, also search by applicableLevel
  if (LEVEL_VALUES.includes(term)) {
    orConditions.push({ applicableLevel: term });
  }

  const sizeCharts = await SizeChart.find({ $or: orConditions })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean();

  if (!sizeCharts.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No results found", {
      sizeCharts: [],
      total: 0,
      fromCache: false,
    });
  }

  await setCache(cacheKey, sizeCharts, CACHE_TTL_LIST);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Search results fetched successfully", {
    sizeCharts,
    total: sizeCharts.length,
    fromCache: false,
  });
});
