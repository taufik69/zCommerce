const { customError } = require("../lib/CustomError");
const {
  SupplierModel,
  SupplierDuePayment,
} = require("../models/supplier.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  supplierDTO,
  supplierListDTO,
  supplierDuePaymentDTO,
} = require("../dtos/all.dto");

// @desc create a new supplier
exports.createSupplier = asynchandeler(async (req, res) => {
  const supplier = new SupplierModel(req.body);
  await supplier.save();
  if (!supplier) apiResponse.sendError(res, 404, "Supplier not found");
  apiResponse.sendSuccess(
    res,
    201,
    "Supplier created successfully",
    supplierDTO(supplier),
  );
});

// get all supplier data

exports.getAllSupplier = asynchandeler(async (req, res) => {
  const { supplierId } = req.query;
  let query = {};
  if (supplierId) {
    query.supplierId = supplierId;
  } else {
    query.isActive = true;
  }
  const suppliers = await SupplierModel.aggregate([
    { $match: query },

    {
      $lookup: {
        from: "purchases",
        localField: "supplierId",
        foreignField: "supplierId",
        as: "purchases",
      },
    },

    {
      $addFields: {
        totalPurchaseDue: {
          $add: [
            { $ifNull: ["$openingDues", 0] },
            { $ifNull: [{ $sum: "$purchases.dueamount" }, 0] },
          ],
        },
      },
    },

    // purchases array remove
    {
      $project: {
        purchases: 0,
        __v: 0,
        deletedAt: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  ]);

  apiResponse.sendSuccess(
    res,
    200,
    "Supplier data fetched successfully",
    suppliers,
  );
});

// update supplier module
exports.updateSupplier = asynchandeler(async (req, res) => {
  const supplier = await SupplierModel.findOneAndUpdate(
    { supplierId: req.params.supplierId },
    req.body,
    {
      new: true,
    },
  );
  if (!supplier) apiResponse.sendError(res, 404, "Supplier not found");
  apiResponse.sendSuccess(
    res,
    200,
    "Supplier updated successfully",
    supplierDTO(supplier),
  );
});

// delete supplier module
exports.deleteSupplier = asynchandeler(async (req, res) => {
  const supplier = await SupplierModel.findOneAndDelete({
    supplierId: req.params.supplierId,
  });
  if (!supplier) apiResponse.sendError(res, 404, "Supplier not found");
  apiResponse.sendSuccess(
    res,
    200,
    "Supplier deleted successfully",
    supplierDTO(supplier),
  );
});

// soft delete
exports.softDeleteSupplier = asynchandeler(async (req, res) => {
  const { deleteSupplier } = req.query;
  if (deleteSupplier === "true") {
    const supplier = await SupplierModel.findOneAndUpdate(
      { supplierId: req.params.supplierId },
      { isActive: false, deletedAt: Date.now() },
      {
        new: true,
      },
    );
    if (!supplier) apiResponse.sendError(res, 404, "Supplier not found");
    apiResponse.sendSuccess(
      res,
      200,
      "Supplier deleted successfully",
      supplierDTO(supplier),
    );
  } else {
    const supplier = await SupplierModel.findOneAndUpdate(
      { supplierId: req.params.supplierId },
      { isActive: true, deletedAt: null },
      {
        new: true,
      },
    );
    if (!supplier) apiResponse.sendError(res, 404, "Supplier not found");
    apiResponse.sendSuccess(
      res,
      200,
      "Supplier deleted successfully",
      supplierDTO(supplier),
    );
  }
});

// createSupplierDuePayment
exports.createSupplierDuePayment = asynchandeler(async (req, res) => {
  const {
    supplierId,
    paidAmount = 0,
    lessAmount = 0,
    paymentMode,
    remarks,
    date,
  } = req.body;

  //  basic guard
  const totalReduce = Number(paidAmount) + Number(lessAmount);

  if (totalReduce <= 0)
    return apiResponse.sendError(
      res,
      400,
      "Paid amount or less amount must be greater than 0",
    );

  //  find supplier first
  const supplier = await SupplierModel.findOne({ supplierId, isActive: true });
  if (!supplier) return apiResponse.sendError(res, 404, "Supplier not found");

  const currentDue = Number(supplier.openingDues || 0);

  // prevent negative due
  if (totalReduce > currentDue) {
    return apiResponse.sendError(
      res,
      400,
      `Payment exceeds due. Current due: ${currentDue}, you tried: ${totalReduce}`,
    );
  }

  // update supplier due
  supplier.openingDues = currentDue - totalReduce;
  await supplier.save();

  // create payment history
  const paymentDoc = await SupplierDuePayment.create({
    supplierId,
    date: date || new Date(),
    paidAmount,
    lessAmount,
    paymentMode,
    remarks,
    remainingDue: supplier.openingDues,
  });

  apiResponse.sendSuccess(
    res,
    201,
    "Supplier due payment created successfully",
    {
      supplier: supplierDTO(supplier),
      payment: supplierDuePaymentDTO(paymentDoc),
    },
  );
});
