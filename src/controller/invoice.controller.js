const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const purchaseModel = require("../models/purchase.model");
const byReturnModel = require("../models/byReturnSale.model");
const orderModel = require("../models/order.model");

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
// exports.getCourierInfo = asynchandeler(async (req, res) => {
//   const courierInfo = await courierModel.find();
//   apiResponse.sendSuccess(
//     res,
//     200,
//     "Courier info fetched successfully",
//     courierInfo
//   );
// });
