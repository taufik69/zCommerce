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

// @desc Purchase invoice report — date range + optional supplier filter, paginated
exports.getPurchaseInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierId, supplierName } = req.body || {};
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", statusCodes.BAD_REQUEST);
  }

  const match = {
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
  };

  if (supplierId) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new customError("Invalid supplierId", statusCodes.BAD_REQUEST);
    }
    match.supplierId = new mongoose.Types.ObjectId(supplierId);
  }

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

  if (supplierName && supplierName.trim() !== "") {
    pipeline.push({
      $match: {
        "supplier.supplierName": { $regex: supplierName.trim(), $options: "i" },
      },
    });
  }

  pipeline.push({
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
  });

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
    pagination: {
      total: totals.count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totals.count / limit)),
      hasNextPage: skip + limit < totals.count,
    },
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

// @desc Suppliers that have at least one purchase — for the report's supplier filter dropdown
exports.getPurchaseInvoiceSuppliers = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(PURCHASE_NS, "report:purchase-invoice:suppliers");
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
