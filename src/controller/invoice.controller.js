const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const purchaseModel = require("../models/purchase.model");
const byReturnModel = require("../models/byReturnSale.model");
const orderModel = require("../models/order.model");
const StockAdjustModel = require("../models/stockadjust.model");
const createTransactionModel = require("../models/crateTransaction.model");
const fundhandoverModel = require("../models/fundHandoverDescription.model");
const invoiceModel = require("../models/invoice.model");
const VariantModel = require("../models/variant.model");
const ProductModel = require("../models/product.model");
const { statusCodes } = require("../constant/constant");

// purchaseSummary
exports.purchaseSummary = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierName } = req.body;

  // Required Validation
  if (!startDate || !endDate) {
    throw new customError(
      "startDate and endDate are required",
      statusCodes.BAD_REQUEST,
    );
  }

  // Match Query
  const match = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (supplierName && supplierName.trim() !== "") {
    match.supplierName = { $regex: `^${supplierName}$`, $options: "i" };
  }

  const result = await purchaseModel.aggregate([
    { $match: match },
    { $unwind: "$allproduct" },

    // Convert IDs
    {
      $addFields: {
        "allproduct.product": {
          $cond: [
            { $ifNull: ["$allproduct.product", false] },
            { $toObjectId: "$allproduct.product" },
            null,
          ],
        },
        "allproduct.variant": {
          $cond: [
            { $ifNull: ["$allproduct.variant", false] },
            { $toObjectId: "$allproduct.variant" },
            null,
          ],
        },
      },
    },

    // Lookup product
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productData",
      },
    },
    { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },

    // Lookup variant
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantData",
      },
    },
    { $unwind: { path: "$variantData", preserveNullAndEmptyArrays: true } },

    // Lookup variant.product → full product in variant
    {
      $lookup: {
        from: "products",
        localField: "variantData.product",
        foreignField: "_id",
        as: "variantProductData",
      },
    },
    {
      $unwind: {
        path: "$variantProductData",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Merge data
    {
      $addFields: {
        "variantData.product": "$variantProductData",
        "allproduct.product": "$productData",
        "allproduct.variant": "$variantData",
      },
    },

    // Group by Product/Variant to calculate totals
    {
      $group: {
        _id: {
          supplierName: "$supplierName",
          product: "$allproduct.product._id",
          variant: "$allproduct.variant._id",
        },
        productName: { $first: "$allproduct.product.name" },
        variantName: { $first: "$allproduct.variant.variantName" },
        color: { $first: "$allproduct.color" },
        size: { $first: "$allproduct.size" },
        totalQuantity: { $sum: "$allproduct.quantity" },
        totalPurchasePrice: { $sum: "$allproduct.purchasePrice" },
        averagePurchasePrice: {
          $avg: "$allproduct.purchasePrice",
        },
      },
    },

    // Supplier wise group
    {
      $group: {
        _id: "$_id.supplierName",
        products: { $push: "$$ROOT" },
        totalSupplierQuantity: { $sum: "$totalQuantity" },
        totalSupplierPurchase: { $sum: "$totalPurchasePrice" },
      },
    },

    // Final summary
    {
      $group: {
        _id: null,
        totalOverallQuantity: { $sum: "$totalSupplierQuantity" },
        totalOverallPurchase: { $sum: "$totalSupplierPurchase" },
        suppliers: { $push: "$$ROOT" },
      },
    },
  ]);

  if (!result.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No data found", []);
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase summary",
    result[0],
  );
});

// buyReturn

exports.getPurchaseBySupplier = asynchandeler(async (req, res) => {
  const { supplierName, startDate, endDate } = req.body || req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const match = {};

  if (supplierName && supplierName.trim() !== "") {
    match.supplierName = { $regex: `^${supplierName}$`, $options: "i" };
  }

  if (startDate && endDate) {
    match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const rowPipeline = [
    { $match: match },
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "productData" } },
    { $lookup: { from: "variants", localField: "variant", foreignField: "_id", as: "variantData" } },
    { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$variantData", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        retailPrice: { $ifNull: ["$variantData.retailPrice", "$productData.retailPrice"] },
        productName: "$productData.productTitle",
        variantName: "$variantData.variantName",
        color: "$variantData.color",
        size: "$variantData.size",
        totalRetailPricePerItem: { $multiply: ["$quantity", { $ifNull: ["$variantData.retailPrice", "$productData.retailPrice"] }] },
      },
    },
    {
      $project: {
        _id: 1,
        supplierName: 1,
        productBarCode: 1,
        productName: 1,
        variantName: 1,
        color: 1,
        size: 1,
        quantity: 1,
        retailPrice: 1,
        totalRetailPricePerItem: 1,
        date: 1,
      },
    },
  ];

  const [totalResult, purchases] = await Promise.all([
    byReturnModel.aggregate([
      ...rowPipeline,
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalRetailPrice: { $sum: "$totalRetailPricePerItem" },
          total: { $sum: 1 },
        },
      },
    ]),
    byReturnModel.aggregate([
      ...rowPipeline,
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
  ]);

  if (!purchases.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No data found for this supplier", {
      purchases: [],
      totalQuantity: 0,
      totalRetailPrice: 0,
      pagination: { total: 0, page, limit, hasNextPage: false },
    });
  }

  const totals = totalResult[0] || { totalQuantity: 0, totalRetailPrice: 0, total: 0 };

  apiResponse.sendSuccess(res, statusCodes.OK, "Supplier purchase data fetched successfully", {
    purchases,
    totalQuantity: totals.totalQuantity,
    totalRetailPrice: totals.totalRetailPrice,
    pagination: {
      total: totals.total,
      page,
      limit,
      hasNextPage: skip + limit < totals.total,
    },
  });
});

// geta all order and calculate tatoal product price or varinat producxt price or deliveryCharge price
exports.getInvoiceReport = asynchandeler(async (req, res) => {
  const startDate = req.query.startDate || req.body?.startDate;
  const endDate = req.query.endDate || req.body?.endDate;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const basePipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "followUp",
        foreignField: "_id",
        as: "followUpData",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $lookup: {
        from: "deliveries",
        localField: "deliveryCharge",
        foreignField: "_id",
        as: "deliveryData",
        pipeline: [{ $project: { amount: 1 } }],
      },
    },
    {
      $addFields: {
        followUpName: { $ifNull: [{ $arrayElemAt: ["$followUpData.name", 0] }, "-"] },
        deliveryAmount: { $ifNull: [{ $arrayElemAt: ["$deliveryData.amount", 0] }, 0] },
      },
    },
  ];

  const [summaryResult, totalResult, orders] = await Promise.all([
    orderModel.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalOrderValue: { $sum: "$finalAmount" },
          totalDiscountValue: { $sum: "$discountAmount" },
          totalDeliveryValue: { $sum: "$deliveryAmount" },
          totalPendingQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Pending"] }, 1, 0] } },
          totalPendingValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Pending"] }, "$finalAmount", 0] } },
          totalHoldQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Hold"] }, 1, 0] } },
          totalHoldValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Hold"] }, "$finalAmount", 0] } },
          totalConfirmedQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Confirmed"] }, 1, 0] } },
          totalConfirmedValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Confirmed"] }, "$finalAmount", 0] } },
          totalPackagingQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Packaging"] }, 1, 0] } },
          totalPackagingValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Packaging"] }, "$finalAmount", 0] } },
          totalCourierQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Courier"] }, 1, 0] } },
          totalCourierValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Courier"] }, "$finalAmount", 0] } },
          totalDeliveredQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] } },
          totalDeliveredValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, "$finalAmount", 0] } },
          totalCancelledQty: { $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] } },
          totalCancelledValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, "$finalAmount", 0] } },
        },
      },
    ]),
    orderModel.aggregate([...basePipeline, { $count: "total" }]),
    orderModel.aggregate([
      ...basePipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          orderId: "$invoiceId",
          date: "$createdAt",
          customerInfo: {
            name: "$shippingInfo.fullName",
            phone: "$shippingInfo.phone",
            address: "$shippingInfo.address",
          },
          productInfo: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                productName: "$$item.name",
                color: "$$item.color",
                size: "$$item.size",
                sku: "$$item.sku",
                quantity: "$$item.quantity",
                retailPrice: "$$item.retailPrice",
                totalPrice: "$$item.totalPrice",
              },
            },
          },
          total: { $sum: "$items.retailPrice" },
          discount: { $ifNull: ["$discountAmount", 0] },
          subTotal: { $ifNull: ["$finalAmount", 0] },
          delivery: "$deliveryAmount",
          followUpBy: "$followUpName",
          status: "$orderStatus",
        },
      },
    ]),
  ]);

  const summary = summaryResult[0] || {
    totalOrders: 0, totalOrderValue: 0, totalDiscountValue: 0, totalDeliveryValue: 0,
    totalPendingQty: 0, totalPendingValue: 0, totalHoldQty: 0, totalHoldValue: 0,
    totalConfirmedQty: 0, totalConfirmedValue: 0, totalPackagingQty: 0, totalPackagingValue: 0,
    totalCourierQty: 0, totalCourierValue: 0, totalDeliveredQty: 0, totalDeliveredValue: 0,
    totalCancelledQty: 0, totalCancelledValue: 0,
  };
  delete summary._id;
  const totalCount = totalResult[0]?.total || 0;

  apiResponse.sendSuccess(res, statusCodes.OK, "Invoice report fetched successfully", {
    reportPeriod: { startDate, endDate },
    summary,
    orderList: orders,
    pagination: {
      total: totalCount,
      page,
      limit,
      hasNextPage: skip + limit < totalCount,
    },
  });
});

// get all order info
exports.getOrderSummaryByDate = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const match = {};
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const summary = await orderModel.aggregate([
    // 🔍 Optional date filter
    { $match: match },

    // 🧮 Group by order status
    {
      $group: {
        _id: "$orderStatus",
        totalQty: { $sum: 1 },
        totalValue: { $sum: "$finalAmount" },
      },
    },

    // 📊 Combine all statuses + calculate grand total + total orders + total amount
    {
      $group: {
        _id: null,
        statuses: { $push: "$$ROOT" },
        grandTotalQty: { $sum: "$totalQty" },
        grandTotalValue: { $sum: "$totalValue" },
        totalOrderCount: { $sum: "$totalQty" },
        totalAmount: { $sum: "$totalValue" }, // sum of all order amounts
      },
    },

    // 🧾 Final projection
    {
      $project: {
        _id: 0,
        statuses: 1,
        grandTotal: {
          qty: "$grandTotalQty",
          value: "$grandTotalValue",
        },
        totalOrderCount: 1,
        totalAmount: 1,
      },
    },
  ]);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Date-wise order summary fetched successfully",
    summary[0] || {
      statuses: [],
      grandTotal: { qty: 0, value: 0 },
      totalOrderCount: 0,
      totalAmount: 0,
    },
  );
});

// get courier info
exports.getCourierSendInformation = asynchandeler(async (req, res) => {
  const { startDate, endDate, courierName } = req.body;

  const filter = {};

  // ✅ Date range filter
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // ✅ Exact courier name filter
  if (courierName && courierName.trim() !== "") {
    filter["courier.name"] = courierName;
  }

  // ✅ Fetch orders with populated followUp and deliveryCharge
  const orders = await orderModel
    .find(filter)
    .populate("followUp", "fullName") // get followUp name
    .populate("deliveryCharge") // get delivery document
    .lean();

  if (!orders.length) {
    throw new customError(
      "No courier data found for given filter",
      statusCodes.NOT_FOUND,
    );
  }

  // ✅ Calculate totals
  let totalDeliveryCharge = 0;
  let totalProductAmount = 0;
  let productTotal = 0;

  const ordersWithDelivery = orders.map((order) => {
    const deliveryChargeAmount = order.deliveryCharge?.deliveryCharge || 0;
    const finalAmount = order.finalAmount || 0;

    totalDeliveryCharge += deliveryChargeAmount;
    totalProductAmount += finalAmount;

    return {
      ...order,
      deliveryCharge: deliveryChargeAmount,
      followUp: order.followUp?.fullName || "N/A",
    };
  });

  // calculate product or varinat total reatial price and quantity
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.product) {
        productTotal += item.product.retailPrice * item.quantity;
      }

      if (item.variant) {
        productTotal += item.variant.retailPrice * item.quantity;
      }
    });
  });

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Courier information fetched successfully",
    {
      orders: ordersWithDelivery,
      totalProductAmount,
      totalDeliveryCharge,
      productTotal,
    },
  );
});
exports.overallStock = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const excludeFields = {
    description: 0, warrantyInformation: 0, shippingInformation: 0,
    retailProfitMarginbyPercentance: 0, retailProfitMarginbyAmount: 0,
    wholesaleProfitMarginPercentage: 0, wholesaleProfitMarginAmount: 0,
    reviews: 0, updatedAt: 0,
  };

  const stockAdjusts = await StockAdjustModel.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "productId",
        pipeline: [
          { $project: excludeFields },
          { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category" } },
          { $lookup: { from: "subcategories", localField: "subcategory", foreignField: "_id", as: "subcategory" } },
          { $lookup: { from: "brands", localField: "brand", foreignField: "_id", as: "brand" } },
          { $lookup: { from: "discounts", localField: "discount", foreignField: "_id", as: "discount" } },
          { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
          { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },
          { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
          { $unwind: { path: "$discount", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$productId", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "variants",
        localField: "variantId",
        foreignField: "_id",
        as: "variantId",
        pipeline: [
          {
            $project: {
              retailProfitMarginbyAmount: 0, wholesaleProfitMarginPercentage: 0,
              wholesaleProfitMarginAmount: 0, reviews: 0, updatedAt: 0,
              retailProfitMarginbyPercentance: 0,
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "product",
              pipeline: [
                { $project: excludeFields },
                { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category" } },
                { $lookup: { from: "subcategories", localField: "subcategory", foreignField: "_id", as: "subcategory" } },
                { $lookup: { from: "brands", localField: "brand", foreignField: "_id", as: "brand" } },
                { $lookup: { from: "discounts", localField: "discount", foreignField: "_id", as: "discount" } },
                { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
                { $unwind: { path: "$discount", preserveNullAndEmptyArrays: true } },
              ],
            },
          },
          { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        ],
      },
    },
    { $unwind: { path: "$variantId", preserveNullAndEmptyArrays: true } },
  ]);

  if (!stockAdjusts.length) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No stock adjustments found", []);
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Stock adjustments retrieved successfully", stockAdjusts);
});

// get account all
// ...existing code...
exports.getAllAccounts = asynchandeler(async (req, res) => {
  // fetch transactions that have account reference and populate only needed fields
  const transactions = await createTransactionModel
    .find({ account: { $exists: true } })
    .populate("account", "_id name")
    .select("account -_id");

  if (!transactions.length) {
    throw new customError("No accounts found", statusCodes.NOT_FOUND);
  }

  // collect unique accounts using Map (keyed by id)
  const uniqueAccountsMap = new Map();
  transactions.forEach((tx) => {
    const acc = tx.account;
    if (acc && acc._id) {
      uniqueAccountsMap.set(acc._id.toString(), {
        _id: acc._id,
        name: acc.name,
      });
    }
  });

  // convert to array and sort by name
  const uniqueAccounts = Array.from(uniqueAccountsMap.values()).sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Accounts fetched successfully",
    uniqueAccounts,
  );
});

//get transaction category
exports.getTransactionCategories = asynchandeler(async (req, res) => {
  const categories = await createTransactionModel
    .find({ transactionCategory: { $exists: true } })
    .populate("transactionCategory")
    .select("transactionCategory -_id ")
    .sort({ createdAt: 1 });
  if (!categories.length) {
    throw new customError(
      "No transaction categories found",
      statusCodes.NOT_FOUND,
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction categories fetched successfully",
    categories,
  );
});
// transaction report
exports.getTransactionReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, transactionCategory } = req.body;

  const filter = {};

  // ✅ Validate and apply date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
    filter.date = {
      $gte: start,
      $lte: end,
    };
  }

  // ✅ Category filter (only if valid)
  if (transactionCategory && transactionCategory.trim() !== "") {
    filter.transactionCategory = transactionCategory;
  }

  // 🔍 Fetch transactions
  const transactions = await createTransactionModel
    .find(filter)
    .populate("transactionCategory")
    .populate("account")
    .sort({ date: -1 });

  // 🧮 If no transactions found
  if (!transactions.length) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Transaction not found !!",
      {
        filters: { startDate, endDate, transactionCategory },
        summary: { cashReceived: 0, cashPayment: 0 },
        transactions: [],
      },
    );
  }

  // 🧮 Calculate totals
  let cashReceived = 0;
  let cashPayment = 0;

  transactions.forEach((tx) => {
    const type = tx.transactionType?.toLowerCase();
    if (type === "cash recived") cashReceived += tx.amount;
    else if (type === "cash payment") cashPayment += tx.amount;
  });

  const summary = { cashReceived, cashPayment };

  //  Send Response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction report fetched successfully",
    {
      filters: { startDate, endDate, transactionCategory },
      summary,
      transactions,
    },
  );
});

// transaction summary
exports.getTransactionSummaryByDate = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const match = {};

  //  Filter by date range
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const report = await createTransactionModel.aggregate([
    { $match: match },

    //  Join category
    {
      $lookup: {
        from: "transitioncategories",
        localField: "transactionCategory",
        foreignField: "_id",
        as: "transactionCategory",
      },
    },
    {
      $unwind: {
        path: "$transactionCategory",
        preserveNullAndEmptyArrays: true,
      },
    },

    //  Sort by latest date before grouping
    { $sort: { date: -1 } },

    //  Group by category and transaction type
    {
      $group: {
        _id: {
          category: "$transactionCategory.name",
          type: "$transactionType",
        },
        totalAmount: { $sum: "$amount" },
        latestDescription: { $first: "$transactionDescription" },
      },
    },

    //  Pivot payment/receive into same row
    {
      $group: {
        _id: "$_id.category",
        description: { $first: "$latestDescription" },
        receivedAmount: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "cash recived"] }, "$totalAmount", 0],
          },
        },
        paymentAmount: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "cash payment"] }, "$totalAmount", 0],
          },
        },
      },
    },

    // Sort alphabetically or by name
    { $sort: { _id: 1 } },
  ]);

  //  Add serial number and grand total
  let serial = 1;
  let grandReceived = 0;
  let grandPayment = 0;

  const data = report.map((item) => {
    grandReceived += item.receivedAmount;
    grandPayment += item.paymentAmount;
    return {
      serial: serial++,
      categoryName: item._id || "Unknown",
      description: item.description || "-",
      receivedAmount: item.receivedAmount,
      paymentAmount: item.paymentAmount,
    };
  });

  const summary = {
    grandReceived,
    grandPayment,
    netBalance: grandReceived - grandPayment,
  };

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Date-wise transaction summary fetched successfully",
    {
      filters: { startDate, endDate },
      summary,
      report: data,
    },
  );
});

// getCashLedgerReport
exports.getCashLedgerReport = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const match = {};

  if (startDate && endDate) {
    match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const basePipeline = [
    { $match: match },
    {
      $lookup: {
        from: "transitioncategories",
        localField: "transactionCategory",
        foreignField: "_id",
        as: "transactionCategory",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$transactionCategory", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "account",
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
  ];

  const [summaryResult, totalResult, transactions] = await Promise.all([
    createTransactionModel.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalCashReceived: { $sum: { $cond: [{ $eq: ["$transactionType", "cash recived"] }, "$amount", 0] } },
          totalCashPayment: { $sum: { $cond: [{ $eq: ["$transactionType", "cash payment"] }, "$amount", 0] } },
        },
      },
    ]),
    createTransactionModel.aggregate([...basePipeline, { $count: "total" }]),
    createTransactionModel.aggregate([
      ...basePipeline,
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          transactionId: { $toString: "$_id" },
        },
      },
    ]),
  ]);

  const totals = summaryResult[0] || { totalCashReceived: 0, totalCashPayment: 0 };
  const totalCount = totalResult[0]?.total || 0;
  const balance = totals.totalCashReceived - totals.totalCashPayment;

  apiResponse.sendSuccess(res, statusCodes.OK, "Cash ledger report fetched successfully", {
    totalCashReceived: totals.totalCashReceived,
    totalCashPayment: totals.totalCashPayment,
    balance,
    transactions,
    pagination: {
      total: totalCount,
      page,
      limit,
      hasNextPage: skip + limit < totalCount,
    },
  });
});

// account wise transaction summary
exports.getTransactionSummaryByDateAndAccount = asynchandeler(
  async (req, res) => {
    const { startDate, endDate, account } = req.body;

    const match = {};

    //  Date range filter
    if (startDate && endDate) {
      match.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Account filter (only if provided)
    if (account && account !== "") {
      match.account = new mongoose.Types.ObjectId(account);
    }

    const report = await createTransactionModel.aggregate([
      { $match: match },

      //  Join account info
      {
        $lookup: {
          from: "accounts",
          localField: "account",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

      //  Group by date
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          receivedAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactionType", "cash recived"] },
                "$amount",
                0,
              ],
            },
          },
          paymentAmount: {
            $sum: {
              $cond: [
                { $eq: ["$transactionType", "cash payment"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },

      //  Calculate balance
      {
        $addFields: {
          balance: { $subtract: ["$receivedAmount", "$paymentAmount"] },
        },
      },

      //  Sort by date ascending
      { $sort: { _id: 1 } },
    ]);

    // Add serial number + grand totals
    let serial = 1;
    let totalReceived = 0;
    let totalPayment = 0;
    let totalBalance = 0;

    const data = report.map((item) => {
      totalReceived += item.receivedAmount;
      totalPayment += item.paymentAmount;
      totalBalance += item.balance;

      return {
        serial: serial++,
        date: item._id,
        receivedAmount: item.receivedAmount,
        paymentAmount: item.paymentAmount,
        balance: item.balance,
      };
    });

    const summary = {
      totalReceived,
      totalPayment,
      totalBalance,
    };

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Transaction summary fetched successfully",
      {
        filters: { startDate, endDate, account: account || "All Accounts" },
        summary,
        report: data,
      },
    );
  },
);

// account name wise summary
exports.getAcoountNamewiseTransaction = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;

  const match = {};

  //  Date range filter
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const report = await createTransactionModel.aggregate([
    { $match: match },

    //  Join account info
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

    //  Group by account name
    {
      $group: {
        _id: "$account.name", // Group by account name
        receivedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$transactionType", "cash recived"] },
              "$amount",
              0,
            ],
          },
        },
        paymentAmount: {
          $sum: {
            $cond: [
              { $eq: ["$transactionType", "cash payment"] },
              "$amount",
              0,
            ],
          },
        },
      },
    },

    //  Add balance field
    {
      $addFields: {
        balance: { $subtract: ["$receivedAmount", "$paymentAmount"] },
      },
    },

    //  Sort by account name ascending
    { $sort: { _id: 1 } },
  ]);
  if (!report.length) {
    throw new customError("No transactions found", statusCodes.NOT_FOUND);
  }

  // Serial number and grand total calculation
  let serial = 1;
  let totalReceived = 0;
  let totalPayment = 0;
  let totalBalance = 0;

  const data = report.map((item) => {
    totalReceived += item.receivedAmount;
    totalPayment += item.paymentAmount;
    totalBalance += item.balance;

    return {
      serial: serial++,
      accountName: item._id || "Unknown Account",
      receivedAmount: item.receivedAmount,
      paymentAmount: item.paymentAmount,
      balance: item.balance,
    };
  });

  //  Grand totals
  const summary = {
    totalReceived,
    totalPayment,
    totalBalance,
  };
  // Final API response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Account-wise transaction summary fetched successfully",
    {
      filters: { startDate, endDate },
      summary,
      report: data,
    },
  );
});

// fund hanover
exports.getFundHandoverReport = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;

  const match = {};
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const report = await fundhandoverModel.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "accounts",
        localField: "fundPaymentMode",
        foreignField: "_id",
        as: "fundPaymentMode",
      },
    },
    {
      $unwind: {
        path: "$fundPaymentMode",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$name",
        totalAmount: { $sum: "$amount" },
        handovers: {
          $push: {
            date: "$date",
            fundHandoverId: "$_id",
            description: "$transactionDescription",
            voucherNumber: "$voucherNumber",
            paymentMode: "$fundPaymentMode.name",
            amount: "$amount",
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  //  Merge all into a single object
  let serial = 1;
  let grandTotal = 0;
  let details = [];

  report.forEach((person) => {
    grandTotal += person.totalAmount;

    const personDetails = person.handovers.map((item) => ({
      date: item.date ? item.date.toISOString().split("T")[0] : "",
      fundHandoverId: item.fundHandoverId,
      description: item.description || "N/A",
      voucherNumber: item.voucherNumber || "N/A",
      paymentMode: item.paymentMode || "N/A",
      amount: item.amount || 0,
      giverReceiver: person._id || "Unknown",
      serial: `FHTRX-${String(serial++).padStart(6, "0")}`,
    }));

    details = details.concat(personDetails);
  });

  const finalReport = {
    serial: 1,
    giverReceiver: "All",
    totalAmount: grandTotal,
    details,
  };

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fund handover report fetched successfully (merged into single object)",
    finalReport,
  );
});

//INVOICE WISE WEB PROFIT

exports.getInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;

  const match = {};

  // Date filter
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const invoices = await invoiceModel.aggregate([
    { $match: match },

    // Project required fields
    {
      $project: {
        invoiceId: 1,
        orderId: "$order",
        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        customerName: "$customerDetails.fullName",
        customerMobile: "$customerDetails.phone",
        finalAmount: 1,
        ProductInfo: 1,
      },
    },

    // Calculate profit per invoice
    {
      $addFields: {
        profit: {
          $sum: {
            $map: {
              input: "$ProductInfo",
              as: "p",
              in: {
                $subtract: ["$$p.retailPrice", "$$p.purchasePrice"],
              },
            },
          },
        },
      },
    },

    // Sort by date ascending
    { $sort: { createdAt: 1 } },
  ]);

  // Calculate totals
  let totalFinalAmount = 0;
  let totalProfit = 0;

  const resultArray = invoices.map((inv) => {
    totalFinalAmount += inv.finalAmount || 0;
    totalProfit += inv.profit || 0;
    return inv;
  });

  // Push summary as last object
  resultArray.push({
    summary: true,
    totalFinalAmount,
    totalProfit,
  });

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Invoice report fetched successfully",
    resultArray,
  );
});

// net wise profit

exports.getInvoiceNetWiseProfit = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;

  const match = {};

  // Date filter
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const invoices = await invoiceModel.aggregate([
    { $match: match },

    // Project required fields
    {
      $project: {
        ProductInfo: 1,
      },
    },

    // Calculate profit per invoice
    {
      $addFields: {
        profit: {
          $sum: {
            $map: {
              input: "$ProductInfo",
              as: "p",
              in: {
                $subtract: ["$$p.retailPrice", "$$p.purchasePrice"],
              },
            },
          },
        },
      },
    },

    {
      $project: {
        profit: 1,
      },
    },

    // Sort by date ascending
    { $sort: { createdAt: 1 } },
  ]);

  // Calculate totals
  let totalProfit = 0;

  invoices.map((inv) => {
    totalProfit += inv.profit || 0;
  });

  // get all transactions summamry

  const report = await createTransactionModel.aggregate([
    { $match: match },

    //  Join category
    {
      $lookup: {
        from: "transitioncategories",
        localField: "transactionCategory",
        foreignField: "_id",
        as: "transactionCategory",
      },
    },
    {
      $unwind: {
        path: "$transactionCategory",
        preserveNullAndEmptyArrays: true,
      },
    },

    //  Sort by latest date before grouping
    { $sort: { date: -1 } },

    //  Group by category and transaction type
    {
      $group: {
        _id: {
          category: "$transactionCategory.name",
          type: "$transactionType",
        },
        totalAmount: { $sum: "$amount" },
        latestDescription: { $first: "$transactionDescription" },
      },
    },
    // Pivot payment/receive into same row
    {
      $group: {
        _id: "$_id.category",
        description: { $first: "$latestDescription" },
        receivedAmount: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "cash recived"] }, "$totalAmount", 0],
          },
        },
        paymentAmount: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "cash payment"] }, "$totalAmount", 0],
          },
        },
      },
    },

    //  Sort alphabetically or by name
    { $sort: { _id: 1 } },
  ]);

  //  Add serial number and grand total
  let serial = 1;
  let grandReceived = 0;
  let grandPayment = 0;

  const data = report.map((item) => {
    grandReceived += item.receivedAmount;
    grandPayment += item.paymentAmount;
    return {
      serial: serial++,
      categoryName: item._id || "Unknown",
      description: item.description || "-",
      receivedAmount: item.receivedAmount,
      paymentAmount: item.paymentAmount,
    };
  });

  const summary = {
    grandReceived,
    grandPayment,
    netBalance: grandReceived - grandPayment,
  };

  let resultArray = [];
  resultArray.push({
    ...summary,
    report: data,
    totalProfit,
  });

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Invoice report fetched successfully",
    resultArray,
  );
});

//USER WEB SALES INVOICE
exports.getOrdersByDateAndFollowUp = asynchandeler(async (req, res) => {
  const { startDate, endDate, followUpId } = req.body;

  const match = {};

  // Date filter
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // FollowUp filter
  if (followUpId) {
    match.followUp = followUpId;
  }

  const orders = await orderModel
    .find(match)
    .populate("user")
    .populate("items.productId")
    .populate("followUp")
    .populate("items.variantId")
    .populate("coupon")
    .populate("deliveryCharge")
    .sort({ createdAt: -1 });

  if (!orders.length) {
    throw new customError("No orders found", statusCodes.NOT_FOUND);
  }

  //  Calculate totals
  const totalDeliveryCharge = orders.reduce(
    (sum, order) => sum + (order.deliveryCharge?.deliveryCharge || 0),
    0,
  );

  const totalPrice = orders.reduce(
    (sum, order) =>
      sum +
      (order.items?.reduce((itemSum, i) => itemSum + (i.totalPrice || 0), 0) ||
        0),
    0,
  );

  apiResponse.sendSuccess(res, statusCodes.OK, "Orders fetched successfully", {
    orders,
    totalDeliveryCharge,
    totalPrice,
  });
});

// push web sales variant
exports.getZeroSaleVariantsLast30Days = asynchandeler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find variants with totalSales = 0
  const variants = await VariantModel.find({
    totalSales: 0,
    createdAt: { $gte: thirtyDaysAgo },
  })
    .populate("product") // populate product name if needed
    .populate("byReturn") // populate byReturn for virtual
    .populate("salesReturn"); // populate salesReturn for virtual
  if (!variants) {
    throw new customError("No variants found", statusCodes.NOT_FOUND);
  }

  // Optionally, map to include virtuals if needed
  const data = variants.map((v) => ({
    _id: v._id,
    variantName: v.variantName,
    product: v.product,
    size: v.size,
    color: v.color,
    totalSales: v.totalSales,
    openingStock: v.openingStock,
    multiVariantOpeningStock: v.multiVariantOpeningStock,
    totalByReturnQuantity: v.totalByReturnQuantity,
    totalSalesReturnQuantity: v.totalSalesReturnQuantity,
    multipleVariantTotalPurchasedQuantity:
      v.multipleVariantTotalPurchasedQuantity,
  }));

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Last 30 days zero sale variants fetched successfully",
    data,
  );
});

// push web sales product
exports.getZeroSaleProductsLast30Days = asynchandeler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find products with totalSales = 0 in last 30 days
  const products = await ProductModel.find({
    totalSales: 0,
    createdAt: { $gte: thirtyDaysAgo },
  })
    .populate("variant") // include variants for size-wise stock and other virtuals
    .populate("byReturn")
    .populate("salesReturn");
  if (!products) {
    throw new customError("No products found", statusCodes.NOT_FOUND);
  }

  // Map to include virtuals and relevant fields
  const data = products.map((p) => ({
    _id: p._id,
    name: p.name,
    slug: p.slug,
    variantType: p.variantType,
    stock: p.stock,
    openingStock: p.singleVariantOpeningStock,
    adjustmentPlus: p.adjustmentSingleVariantPlus,
    adjustmentMinus: p.adjustmentSingleVariantMinus,
    totalByReturnQuantity: p.totalByReturnQuantity,
    totalSalesReturnQuantity: p.totalSalesReturnQuantity,
    singleVariantTotalPurchasedQuantity: p.singleVariantTotalPurchasedQuantity,
    sizeWiseStock: p.sizeWiseStock,
    totalSales: p.totalSales,
  }));

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Last 30 days zero sale products fetched successfully",
    data,
  );
});

// get all supplier purchase report
