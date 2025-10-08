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
