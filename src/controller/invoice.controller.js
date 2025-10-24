const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const purchaseModel = require("../models/purchase.model");
const byReturnModel = require("../models/byReturnSale.model");
const orderModel = require("../models/order.model");
const StockAdjustModel = require("../models/stockadjust.model");
const createTransactionModel = require("../models/crateTransaction.model");
const tranasactionCategoryModel = require("../models/transitionCategory.model");
const fundhandoverModel = require("../models/fundHandoverDescription.model");
const invoiceModel = require("../models/invoice.model");
const VariantModel = require("../models/variant.model");
const ProductModel = require("../models/product.model");
const accountModel = require("../models/account.model");

exports.purchaseInvoice = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierName } = req.body;

  // Required validation
  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", 400);
  }

  // Base match query
  const match = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  // Optional supplierName filter
  if (supplierName && supplierName.trim() !== "") {
    match.supplierName = { $regex: supplierName, $options: "i" };
  }

  const result = await purchaseModel.aggregate([
    { $match: match },
    { $unwind: { path: "$allproduct", preserveNullAndEmptyArrays: true } },

    // ✅ Convert IDs safely
    {
      $addFields: {
        "allproduct.product": {
          $cond: [
            {
              $and: [
                { $ne: ["$allproduct.product", null] },
                { $ne: ["$allproduct.product", ""] },
              ],
            },
            { $toObjectId: "$allproduct.product" },
            null,
          ],
        },
        "allproduct.variant": {
          $cond: [
            {
              $and: [
                { $ne: ["$allproduct.variant", null] },
                { $ne: ["$allproduct.variant", ""] },
              ],
            },
            { $toObjectId: "$allproduct.variant" },
            null,
          ],
        },
      },
    },

    // ✅ Lookup product (main)
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productData",
      },
    },
    { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },

    // ✅ Lookup variant
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantData",
      },
    },
    { $unwind: { path: "$variantData", preserveNullAndEmptyArrays: true } },

    // ✅ Lookup variant.product → populate variant's product object
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

    // ✅ Merge all fields properly
    {
      $addFields: {
        "variantData.product": "$variantProductData",
        "allproduct.variant": "$variantData",
        "allproduct.product": "$productData",
      },
    },

    // Clean temp data
    {
      $project: {
        productData: 0,
        variantData: 0,
        variantProductData: 0,
      },
    },

    // ✅ Group by purchase
    {
      $group: {
        _id: "$_id",
        supplierName: { $first: "$supplierName" },
        invoiceNumber: { $first: "$invoiceNumber" },
        date: { $first: "$date" },
        cashType: { $first: "$cashType" },
        subTotal: { $first: "$subTotal" },
        dueAmount: { $first: "$dueAmount" },
        commission: { $first: "$commission" },
        shipping: { $first: "$shipping" },
        payable: { $first: "$payable" },
        paid: { $first: "$paid" },
        allproduct: { $push: "$allproduct" },
      },
    },

    // ✅ Total summary
    {
      $group: {
        _id: null,
        totalSubTotal: { $sum: "$subTotal" },
        totalCommission: { $sum: "$commission" },
        totalShipping: { $sum: "$shipping" },
        totalPayable: { $sum: "$payable" },
        totalDueAmount: { $sum: "$dueAmount" },
        totalPaid: { $sum: "$paid" },
        allPurchases: { $push: "$$ROOT" },
      },
    },
  ]);

  if (!result.length) {
    return apiResponse.sendSuccess(res, 200, "No data found", []);
  }

  return apiResponse.sendSuccess(res, 200, "Invoice summary", result[0]);
});

// purchaseSummary
exports.purchaseSummary = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierName } = req.body;

  // Required Validation
  if (!startDate || !endDate) {
    throw new customError("startDate and endDate are required", 400);
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
    return apiResponse.sendSuccess(res, 200, "No data found", []);
  }

  return apiResponse.sendSuccess(res, 200, "Purchase summary", result[0]);
});

// buyReturn

exports.getPurchaseBySupplier = asynchandeler(async (req, res) => {
  const { supplierName, startDate, endDate } = req.query;

  const match = {};

  // 🔍 Exact supplier name match (case-insensitive)
  if (supplierName) {
    match.supplierName = {
      $regex: `^${supplierName}$`,
      $options: "i", // case-insensitive exact match
    };
  }

  // 📅 Optional date range filter
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const result = await byReturnModel.aggregate([
    { $match: match },

    // 🔗 Lookup product & variant details
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productData",
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "variant",
        foreignField: "_id",
        as: "variantData",
      },
    },

    // 🧮 Flatten arrays
    {
      $unwind: {
        path: "$productData",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$variantData",
        preserveNullAndEmptyArrays: true,
      },
    },

    // 💰 Calculate dynamic retail price
    {
      $addFields: {
        retailPrice: {
          $ifNull: ["$variantData.retailPrice", "$productData.retailPrice"],
        },
        productName: "$productData.productTitle",
        variantName: "$variantData.variantName",
        color: "$variantData.color",
        size: "$variantData.size",
      },
    },

    // // 🧾 Calculate total retail price per item
    {
      $addFields: {
        totalRetailPricePerItem: { $multiply: ["$quantity", "$retailPrice"] },
      },
    },

    // 📦 Project final structure
    {
      $project: {
        _id: 1,
        serialId: "$_id",
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

    // 📊 Calculate total quantity & retail price
    {
      $group: {
        _id: null,
        purchases: { $push: "$$ROOT" },
        totalQuantity: { $sum: "$quantity" },
        totalRetailPrice: { $sum: "$totalRetailPricePerItem" },
      },
    },
    {
      $project: {
        _id: 0,
        purchases: 1,
        totalQuantity: 1,
        totalRetailPrice: 1,
      },
    },
  ]);

  if (!result.length) {
    throw new customError("No data found for this supplier", 404);
  }

  apiResponse.sendSuccess(
    res,
    200,
    "Supplier purchase data fetched successfully",
    result[0]
  );
});

// get supplier name wise summary
exports.getSupplierSummary = asynchandeler(async (req, res) => {
  const result = await purchaseModel
    .find({
      supplierName: { $ne: "" },
    })
    .select("supplierName");
  apiResponse.sendSuccess(
    res,
    200,
    "Supplier summary fetched successfully",
    result
  );
});

// geta all order and calculate tatoal product price or varinat producxt price or deliveryCharge price
exports.getInvoiceReport = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // 🔍 Date Filter
  const filter = {};
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // 🧾 Fetch Orders
  const orders = await orderModel
    .find(filter)
    .populate("followUp", "name") // Follow up by user name
    .populate("deliveryCharge", "amount")
    .sort({ createdAt: 1 });

  if (!orders.length) {
    return apiResponse.sendSuccess(res, 200, "No invoice data found", []);
  }

  // 🧮 Summary calculation
  const summary = {
    totalOrders: 0,
    totalOrderValue: 0,
    totalDiscountQty: 0,
    totalDiscountValue: 0,
    totalDeliveryValue: 0,
    totalCourierQty: 0,
    totalCourierValue: 0,
    totalPendingQty: 0,
    totalPendingValue: 0,
    totalConfirmedQty: 0,
    totalConfirmedValue: 0,
    totalHoldQty: 0,
    totalHoldValue: 0,
    totalPackagingQty: 0,
    totalPackagingValue: 0,
    totalDeliveredQty: 0,
    totalDeliveredValue: 0,
    totalCancelledQty: 0,
    totalCancelledValue: 0,
  };

  const orderList = orders.map((order) => {
    // === Customer Info ===
    const customerInfo = {
      name: order.shippingInfo.fullName,
      phone: order.shippingInfo.phone,
      address: order.shippingInfo.address,
    };

    // === Product Info ===
    const productInfo = order.items.map((item) => ({
      productName: item.name,
      color: item.color,
      size: item.size,
      sku: item.sku || null, // থাকলে SKU
      quantity: item.quantity,
      retailPrice: item.retailPrice,
      totalPrice: item.totalPrice,
    }));

    // === Price Info ===
    const total = order.items.reduce((sum, i) => sum + (i.retailPrice || 0), 0);
    const discount = order.discountAmount || 0;
    const subTotal = order.finalAmount || 0;

    // === Delivery Info ===
    const delivery = order.deliveryCharge?.amount || 0;

    // === Follow Up ===
    const followUpBy = order.followUp?.name || "-";

    // === Update summary ===
    summary.totalOrders += 1;
    summary.totalOrderValue += subTotal;
    summary.totalDiscountQty += order.items.length;
    summary.totalDiscountValue += discount;
    summary.totalDeliveryValue += delivery;

    // === Status Based Counts ===
    const addTo = (qtyField, valueField, qty, val) => {
      summary[qtyField] += qty;
      summary[valueField] += val;
    };

    switch (order.orderStatus) {
      case "Pending":
        addTo("totalPendingQty", "totalPendingValue", 1, subTotal);
        break;
      case "Hold":
        addTo("totalHoldQty", "totalHoldValue", 1, subTotal);
        break;
      case "Confirmed":
        addTo("totalConfirmedQty", "totalConfirmedValue", 1, subTotal);
        break;
      case "Packaging":
        addTo("totalPackagingQty", "totalPackagingValue", 1, subTotal);
        break;
      case "Courier":
        addTo("totalCourierQty", "totalCourierValue", 1, subTotal);
        break;
      case "Delivered":
        addTo("totalDeliveredQty", "totalDeliveredValue", 1, subTotal);
        break;
      case "Cancelled":
        addTo("totalCancelledQty", "totalCancelledValue", 1, subTotal);
        break;
    }

    // === Final Order Info ===
    return {
      orderId: order.invoiceId,
      date: order.createdAt,
      customerInfo,
      productInfo,
      total,
      discount,
      subTotal,
      delivery,
      followUpBy,
      status: order.orderStatus,
    };
  });

  apiResponse.sendSuccess(res, 200, "Invoice report fetched successfully", {
    reportPeriod: { startDate, endDate },
    summary,
    orderList,
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
    200,
    "Date-wise order summary fetched successfully",
    summary[0] || {
      statuses: [],
      grandTotal: { qty: 0, value: 0 },
      totalOrderCount: 0,
      totalAmount: 0,
    }
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
    throw new customError("No courier data found for given filter", 404);
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
    200,
    "Courier information fetched successfully",
    {
      orders: ordersWithDelivery,
      totalProductAmount,
      totalDeliveryCharge,
      productTotal,
    }
  );
});
exports.overallStock = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query; // or req.body if POST

  const filter = {};

  // ✅ Apply date filter if provided
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const stockAdjusts = await StockAdjustModel.find(filter)
    .populate({
      path: "productId",
      populate: {
        path: "variant category subcategory brand discount",
      },
      select:
        "-description  -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt",
    })
    .populate({
      path: "variantId",
      populate: {
        path: "product",
        populate: "category subcategory brand discount",
        select:
          "-description  -warrantyInformation -shippingInformation -retailProfitMarginbyPercentance -retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt",
      },
      select:
        "-retailProfitMarginbyAmount -wholesaleProfitMarginPercentage -wholesaleProfitMarginAmount -reviews -updatedAt -retailProfitMarginbyPercentance",
    })
    .sort({ createdAt: -1 })
    .lean();

  if (!stockAdjusts.length) {
    throw new customError("No stock adjustments found for given filter", 404);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Stock adjustments retrieved successfully",
    stockAdjusts
  );
});

//get tranaaction category
exports.getTransactionCategories = asynchandeler(async (req, res) => {
  const categories = await tranasactionCategoryModel.find().sort({ name: 1 });
  apiResponse.sendSuccess(
    res,
    200,
    "Transaction categories fetched successfully",
    categories
  );
});

// get account all
exports.getAllAccounts = asynchandeler(async (req, res) => {
  const accounts = await accountModel.find().sort({ name: 1 });
  apiResponse.sendSuccess(res, 200, "Accounts fetched successfully", accounts);
});

// transaction report
exports.getTransactionReport = asynchandeler(async (req, res) => {
  const { startDate, endDate, transactionCategory } = req.query;

  // 🔍 Filter conditions
  const match = {};

  // Date range
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // Category filter
  if (transactionCategory) {
    match.transactionCategory = new mongoose.Types.ObjectId(
      transactionCategory
    );
  }

  // 🧮 Aggregation pipeline
  const report = await createTransactionModel.aggregate([
    { $match: match },

    // populate equivalent via lookup
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

    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

    // 🧮 Calculate totals
    {
      $facet: {
        transactions: [{ $sort: { date: -1 } }], // all transactions
        totals: [
          {
            $group: {
              _id: "$transactionType",
              totalAmount: { $sum: "$amount" },
            },
          },
        ],
      },
    },
  ]);

  // 🧾 Extract summary
  const data = report[0] || { transactions: [], totals: [] };

  let cashReceived = 0;
  let cashPayment = 0;

  data.totals.forEach((t) => {
    if (t._id === "cash recived") cashReceived = t.totalAmount;
    if (t._id === "cash payment") cashPayment = t.totalAmount;
  });

  const summary = {
    cashReceived,
    cashPayment,
  };

  apiResponse.sendSuccess(res, 200, "Transaction report fetched successfully", {
    filters: { startDate, endDate, transactionCategory },
    summary,
    transactions: data.transactions,
  });
});

// transaction summary
exports.getTransactionSummaryByDate = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const match = {};

  // ✅ Filter by date range
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const report = await createTransactionModel.aggregate([
    { $match: match },

    // ✅ Join category
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

    // ✅ Sort by latest date before grouping
    { $sort: { date: -1 } },

    // ✅ Group by category and transaction type
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

    // ✅ Pivot payment/receive into same row
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

    // ✅ Sort alphabetically or by name
    { $sort: { _id: 1 } },
  ]);

  // ✅ Add serial number and grand total
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
    200,
    "Date-wise transaction summary fetched successfully",
    {
      filters: { startDate, endDate },
      summary,
      report: data,
    }
  );
});

// account wise transaction summary
exports.getTransactionSummaryByDateAndAccount = asynchandeler(
  async (req, res) => {
    const { startDate, endDate, account } = req.body;

    const match = {};

    // ✅ Date range filter
    if (startDate && endDate) {
      match.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // ✅ Account filter (only if provided)
    if (account && account !== "") {
      match.account = new mongoose.Types.ObjectId(account);
    }

    const report = await createTransactionModel.aggregate([
      { $match: match },

      // ✅ Join account info
      {
        $lookup: {
          from: "accounts",
          localField: "account",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

      // ✅ Group by date
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

      // ✅ Calculate balance
      {
        $addFields: {
          balance: { $subtract: ["$receivedAmount", "$paymentAmount"] },
        },
      },

      // ✅ Sort by date ascending
      { $sort: { _id: 1 } },
    ]);

    // ✅ Add serial number + grand totals
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
      200,
      "Transaction summary fetched successfully",
      {
        filters: { startDate, endDate, account: account || "All Accounts" },
        summary,
        report: data,
      }
    );
  }
);

// account name wise summary
exports.getAcoountNamewiseTransaction = asynchandeler(async (req, res) => {
  const { startDate, endDate } = req.body;

  const match = {};

  // ✅ Date range filter
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const report = await createTransactionModel.aggregate([
    { $match: match },

    // ✅ Join account info
    {
      $lookup: {
        from: "accounts",
        localField: "account",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

    // ✅ Group by account name
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

    // ✅ Add balance field
    {
      $addFields: {
        balance: { $subtract: ["$receivedAmount", "$paymentAmount"] },
      },
    },

    // ✅ Sort by account name ascending
    { $sort: { _id: 1 } },
  ]);

  // ✅ Serial number and grand total calculation
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

  // ✅ Grand totals
  const summary = {
    totalReceived,
    totalPayment,
    totalBalance,
  };

  // ✅ Final API response
  apiResponse.sendSuccess(
    res,
    200,
    "Account-wise transaction summary fetched successfully",
    {
      filters: { startDate, endDate },
      summary,
      report: data,
    }
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

  // ✅ Merge all into a single object
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
    200,
    "Fund handover report fetched successfully (merged into single object)",
    finalReport
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
    200,
    "Invoice report fetched successfully",
    resultArray
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

    // ✅ Join category
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

    // ✅ Sort by latest date before grouping
    { $sort: { date: -1 } },

    // ✅ Group by category and transaction type
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

    // ✅ Pivot payment/receive into same row
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

    // ✅ Sort alphabetically or by name
    { $sort: { _id: 1 } },
  ]);

  // ✅ Add serial number and grand total
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
    200,
    "Invoice report fetched successfully",
    resultArray
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
  console.log(orders);
  return;

  // ✅ Calculate totals
  const totalDeliveryCharge = orders.reduce(
    (sum, order) => sum + (order.deliveryCharge?.deliveryCharge || 0),
    0
  );

  const totalPrice = orders.reduce(
    (sum, order) =>
      sum +
      (order.items?.reduce((itemSum, i) => itemSum + (i.totalPrice || 0), 0) ||
        0),
    0
  );

  apiResponse.sendSuccess(res, 200, "Orders fetched successfully", {
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
    .populate("stockVariantAdjust") // include adjustments for virtuals
    .populate("byReturn") // populate byReturn for virtual
    .populate("salesReturn"); // populate salesReturn for virtual

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
    200,
    "Last 30 days zero sale variants fetched successfully",
    data
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
    .populate("stockAdjustment")
    .populate("byReturn")
    .populate("salesReturn");

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
    200,
    "Last 30 days zero sale products fetched successfully",
    data
  );
});

// get all supplier purchase report
