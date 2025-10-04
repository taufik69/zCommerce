const mongoose = require("mongoose");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const purchaseModel = require("../models/purchase.model");

exports.purchaseInvoice = asynchandeler(async (req, res) => {
  const { startDate, endDate, supplierName } = req.body;

  if (!startDate || !endDate)
    throw new customError("startDate and endDate are required", 400);

  const match = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (supplierName) {
    match.supplierName = { $regex: supplierName, $options: "i" };
  }

  const result = await purchaseModel.aggregate([
    { $match: match },

    { $unwind: { path: "$allproduct", preserveNullAndEmptyArrays: true } },

    // Convert string IDs to ObjectId
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

    // product lookup
    {
      $lookup: {
        from: "products",
        localField: "allproduct.product",
        foreignField: "_id",
        as: "productData",
      },
    },
    { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },

    // variant lookup
    {
      $lookup: {
        from: "variants",
        localField: "allproduct.variant",
        foreignField: "_id",
        as: "variantData",
      },
    },
    { $unwind: { path: "$variantData", preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        "allproduct.product": "$productData",
        "allproduct.variant": "$variantData",
      },
    },

    { $project: { productData: 0, variantData: 0 } },

    // regroup back
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

    // total summary
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

  if (!result.length)
    return apiResponse.sendSuccess(res, 200, "No data found", []);

  return apiResponse.sendSuccess(res, 200, "Invoice summary", result[0]);
});
