const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const Purchase = require("../models/purchase.model");
const Supplier = require("../models/supplier.model").SupplierModel;
const StoreInformation = require("../models/storeInformation.model");
const { getCache, setCache, buildCacheKey } = require("@/utils/cache.util");

// Shares invalidation with purchase.controller.js (bumpNsVersion("purchase")
// already runs on create/update/delete there) and storeInformation.controller.js
// (bumpNsVersion("storeinformation") on save) — no extra invalidation wiring needed.
const PURCHASE_NS = "purchase";
const STORE_NS = "storeinformation";
const REPORT_CACHE_TTL = 60 * 5; // 5 minutes
const STORE_CACHE_TTL = 60 * 60; // 1 hour

async function getStoreHeader() {
  const cacheKey = await buildCacheKey(STORE_NS, "report-header");
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const store = await StoreInformation.findOne()
    .select("storeName phone secondaryPhone email adress")
    .lean();

  const header = store
    ? {
        storeName: store.storeName,
        phone: store.phone,
        secondaryPhone: store.secondaryPhone || "",
        email: store.email || "",
        address: store.adress,
      }
    : null;

  await setCache(cacheKey, header, STORE_CACHE_TTL);
  return header;
}

// $lookup + $unwind stage pair shared by every purchase-based report that needs
// the supplier's display name (Purchase only stores supplierId).
function supplierLookupStages() {
  return [
    {
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
        pipeline: [{ $project: { supplierName: 1 } }],
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
  ];
}

// Free-text supplier-name search runs after the lookup (it's matching the joined
// field), so it can only be added once. Returns [] when no search term is given.
function supplierNameFilterStage(supplierName) {
  if (!supplierName || supplierName.trim() === "") return [];
  return [
    {
      $match: {
        "supplier.supplierName": { $regex: supplierName.trim(), $options: "i" },
      },
    },
  ];
}

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(total, page, limit, skip) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: skip + limit < total,
  };
}

function castObjectIdFilter(match, field, value) {
  if (!value) return;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new customError(`Invalid ${field}`, statusCodes.BAD_REQUEST);
  }
  match[field] = new mongoose.Types.ObjectId(value);
}

// @desc Purchase invoice report — one row per purchase invoice, date range + optional supplier filter, paginated
exports.getPurchaseInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-invoice:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase invoice report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // Single indexed $match narrows the working set before the supplier lookup,
  // then one $facet pass produces the page rows + full-range totals together
  // — no per-line-item unwind/lookup since this report is invoice-level only.
  const pipeline = [
    { $match: match },
    ...supplierLookupStages(),
    ...supplierNameFilterStage(supplierName),
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              purchaseId: "$serial",
              supplierInvoice: "$invoiceNumber",
              supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
              total: "$subTotal",
              commission: 1,
              delivery: "$shipping",
              payable: 1,
              paid: 1,
              due: "$dueamount",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$subTotal" },
              totalCommission: { $sum: "$commission" },
              totalDelivery: { $sum: "$shipping" },
              totalPayable: { $sum: "$payable" },
              totalPaid: { $sum: "$paid" },
              totalDue: { $sum: "$dueamount" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalAmount: 0,
    totalCommission: 0,
    totalDelivery: 0,
    totalPayable: 0,
    totalPaid: 0,
    totalDue: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
    },
    rows,
    totals: {
      count: totals.count,
      totalAmount: totals.totalAmount,
      totalCommission: totals.totalCommission,
      totalDelivery: totals.totalDelivery,
      totalPayable: totals.totalPayable,
      totalPaid: totals.totalPaid,
      totalDue: totals.totalDue,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase invoice report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Purchase product report — one row per product/variant line item across purchases,
// filterable by date range, supplier, category, subCategory, brand. Paginated.
exports.getPurchaseProductReport = asynchandeler(async (req, res) => {
  const {
    startDate,
    endDate,
    supplierId,
    supplierName,
    category,
    subCategory,
    brand,
  } = req.body || {};
  const { page, limit, skip } = parsePagination(req);

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
  castObjectIdFilter(match, "supplierId", supplierId);
  castObjectIdFilter(match, "category", category);
  castObjectIdFilter(match, "subCategory", subCategory);
  castObjectIdFilter(match, "brand", brand);

  const cacheKey = await buildCacheKey(
    PURCHASE_NS,
    `report:purchase-product:${startDate}:${endDate}:${supplierId || "all"}:${(supplierName || "").trim().toLowerCase()}:${category || "-"}:${subCategory || "-"}:${brand || "-"}:p${page}:l${limit}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase product report fetched successfully",
      { ...cached, fromCache: true },
    );
  }

  // category/subCategory/brand live directly on the Purchase document (not on
  // each line item), so they filter via the same indexed top-level $match as
  // date/supplier — no product-level lookup needed just to apply these filters.
  const pipeline = [
    { $match: match },
    ...supplierLookupStages(),
    ...supplierNameFilterStage(supplierName),
    { $unwind: "$allproduct" },
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productInfo",
        pipeline: [{ $project: { name: 1, barCode: 1 } }],
      },
    },
    { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantInfo",
        pipeline: [
          { $project: { barCode: 1, product: 1 } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "variantProduct",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$variantProduct", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        lineProductName: { $ifNull: ["$variantInfo.variantProduct.name", "$productInfo.name"] },
        lineBarcode: { $ifNull: ["$variantInfo.barCode", "$productInfo.barCode"] },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { date: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              date: 1,
              purchaseId: "$serial",
              supplierInvoice: "$invoiceNumber",
              supplierName: { $ifNull: ["$supplier.supplierName", "-"] },
              productName: { $ifNull: ["$lineProductName", "-"] },
              barcode: { $ifNull: ["$lineBarcode", "-"] },
              color: "$allproduct.color",
              size: "$allproduct.size",
              buyRate: "$allproduct.purchasePrice",
              qty: "$allproduct.quantity",
              wsPrice: "$allproduct.wholesalePrice",
              rsPrice: "$allproduct.retailPrice",
              buyTotal: "$allproduct.subTotal",
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalBuyRate: { $sum: "$allproduct.purchasePrice" },
              totalQty: { $sum: "$allproduct.quantity" },
              totalWsPrice: { $sum: "$allproduct.wholesalePrice" },
              totalRsPrice: { $sum: "$allproduct.retailPrice" },
              totalBuyTotal: { $sum: "$allproduct.subTotal" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Purchase.aggregate(pipeline);
  const rows = result?.rows || [];
  const totals = result?.totals?.[0] || {
    count: 0,
    totalBuyRate: 0,
    totalQty: 0,
    totalWsPrice: 0,
    totalRsPrice: 0,
    totalBuyTotal: 0,
  };

  const header = await getStoreHeader();

  const payload = {
    header,
    filters: {
      startDate,
      endDate,
      supplier: supplierName?.trim() || (supplierId ? "Selected supplier" : "ALL"),
      category: category || "ALL",
      subCategory: subCategory || "ALL",
      brand: brand || "ALL",
    },
    rows,
    totals: {
      count: totals.count,
      totalBuyRate: totals.totalBuyRate,
      totalQty: totals.totalQty,
      totalWsPrice: totals.totalWsPrice,
      totalRsPrice: totals.totalRsPrice,
      totalBuyTotal: totals.totalBuyTotal,
    },
    pagination: paginationMeta(totals.count, page, limit, skip),
    generatedAt: new Date(),
  };

  await setCache(cacheKey, payload, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase product report fetched successfully",
    { ...payload, fromCache: false },
  );
});

// @desc Suppliers that have at least one purchase — for the purchase reports' supplier filter dropdown
exports.getPurchaseInvoiceSuppliers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(PURCHASE_NS, "report:purchase:suppliers");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Supplier list fetched successfully",
      { suppliers: cached, fromCache: true },
    );
  }

  const supplierIds = await Purchase.distinct("supplierId", { supplierId: { $ne: null } });

  const suppliers = await Supplier.find({ _id: { $in: supplierIds } })
    .select("_id supplierName")
    .sort({ supplierName: 1 })
    .lean();

  await setCache(cacheKey, suppliers, REPORT_CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Supplier list fetched successfully",
    { suppliers, fromCache: false },
  );
});
