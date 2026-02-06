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

  const totalReduce = Number(paidAmount) + Number(lessAmount);

  if (totalReduce <= 0) {
    return apiResponse.sendError(
      res,
      400,
      "Paid amount or less amount must be greater than 0",
    );
  }

  // 1️Find supplier
  const supplier = await SupplierModel.findOne({ supplierId, isActive: true });
  if (!supplier) {
    return apiResponse.sendError(res, 404, "Supplier not found");
  }

  const currentDue = Number(supplier.openingDues || 0);

  if (totalReduce > currentDue) {
    return apiResponse.sendError(
      res,
      400,
      `Payment exceeds due. Current due: ${currentDue}`,
    );
  }

  //  Update supplier due
  supplier.openingDues = currentDue - totalReduce;
  await supplier.save();

  //  Find existing payment doc (ONE per supplier)
  let paymentDoc = await SupplierDuePayment.findOne({
    supplierId,
    isActive: true,
  });

  if (paymentDoc) {
    // UPDATE existing
    paymentDoc.paidAmount += Number(paidAmount);
    paymentDoc.lessAmount += Number(lessAmount);
    paymentDoc.remainingDue = supplier.openingDues;
    paymentDoc.paymentMode = paymentMode;
    paymentDoc.remarks = remarks || paymentDoc.remarks;
    paymentDoc.date = date || new Date();

    await paymentDoc.save();
  } else {
    //  CREATE first time only
    paymentDoc = await SupplierDuePayment.create({
      supplierId,
      date: date || new Date(),
      paidAmount,
      lessAmount,
      paymentMode,
      remarks,
      remainingDue: supplier.openingDues,
    });
  }

  apiResponse.sendSuccess(
    res,
    201,
    "Supplier due payment updated successfully",
    {
      ...supplierDTO(supplier),
      payment: supplierDuePaymentDTO(paymentDoc),
    },
  );
});

// get all supplier due payment or single supplier due amount
exports.getAllSupplierDuePayment = asynchandeler(async (req, res) => {
  const matchStage = {};

  if (req.query.supplierId) {
    matchStage.supplierId = req.query.supplierId;
  }

  const payments = await SupplierDuePayment.aggregate([
    {
      $match: matchStage,
    },

    {
      $lookup: {
        from: "suppliers",
        localField: "supplierId",
        foreignField: "supplierId",
        as: "supplier",
      },
    },

    {
      $unwind: {
        path: "$supplier",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        transactionId: 1,
        date: 1,
        supplierId: 1,
        paidAmount: 1,
        lessAmount: 1,
        paymentMode: 1,
        remarks: 1,
        remainingDue: 1,
        isActive: 1,

        supplier: {
          supplierName: 1,
          supplierId: 1,
          mobile: 1,
          supplierAddress: 1,
          openingDues: 1,
          isActive: 1,
          contactPersonDesignation: 1,
          contactPersonName: 1,
        },
      },
    },
  ]);

  apiResponse.sendSuccess(
    res,
    200,
    "Supplier due payment fetched successfully",
    payments,
  );
});

exports.updateSupplierDuePayment = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const { paidAmount, lessAmount, paymentMode, remarks, date } = req.body;

  // 1) find payment doc
  const paymentDoc = await SupplierDuePayment.findOne({ supplierId: id });
  if (!paymentDoc) {
    return apiResponse.sendError(res, 404, "Supplier due payment not found");
  }

  // 2) find supplier
  const supplier = await SupplierModel.findOne({
    supplierId: paymentDoc.supplierId,
    isActive: true,
  });
  if (!supplier) {
    return apiResponse.sendError(res, 404, "Supplier not found");
  }

  const currentDue = Number(supplier.openingDues || 0);

  // old totals
  const oldPaid = Number(paymentDoc.paidAmount || 0);
  const oldLess = Number(paymentDoc.lessAmount || 0);
  const oldTotal = oldPaid + oldLess;

  // new totals (fallback to old if not provided)
  const newPaid = paidAmount !== undefined ? Number(paidAmount) : oldPaid;
  const newLess = lessAmount !== undefined ? Number(lessAmount) : oldLess;
  const newTotal = newPaid + newLess;

  if (newTotal <= 0) {
    return apiResponse.sendError(
      res,
      400,
      "Paid amount + less amount must be greater than 0",
    );
  }

  // difference that impacts supplier due
  const diff = newTotal - oldTotal;

  // If diff > 0 => need to reduce due more
  if (diff > 0 && diff > currentDue) {
    return apiResponse.sendError(
      res,
      400,
      `Update exceeds due. Current due: ${currentDue}, extra reduce needed: ${diff}`,
    );
  }

  // 3) update supplier due
  supplier.openingDues = currentDue - diff; // diff can be negative -> due increases
  if (supplier.openingDues < 0) supplier.openingDues = 0; // safety
  await supplier.save();

  // 4) update payment doc
  paymentDoc.paidAmount = newPaid;
  paymentDoc.lessAmount = newLess;

  if (paymentMode !== undefined) paymentDoc.paymentMode = paymentMode;
  if (remarks !== undefined) paymentDoc.remarks = remarks;
  if (date !== undefined) paymentDoc.date = date;

  paymentDoc.remainingDue = supplier.openingDues;
  paymentDoc.updatedAt = Date.now();

  await paymentDoc.save();

  apiResponse.sendSuccess(
    res,
    200,
    "Supplier due payment updated successfully",
    {
      ...supplierDTO(supplier),
      payment: supplierDuePaymentDTO(paymentDoc),
    },
  );
});
