const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const purchaseModel = require("../models/purchase.model");

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
