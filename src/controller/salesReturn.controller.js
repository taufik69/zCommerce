const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const SalesReturn = require("../models/salesReturn.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Sales = require("../models/sales.model");
const { customerModel } = require("../models/customer.model");
const CrateTransaction = require("../models/crateTransaction.model");
const { validateSalesReturn } = require("../validation/salesReturn.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "salesReturn";
const CACHE_TTL = 60 * 60; // 1 hour

// Deduct the return amount from a listed customer's opening dues (floored at 0).
// Walking customers have no ledger entry — nothing to adjust.
async function applyCustomerDuesForReturn(customerType, amount, session) {
  if (customerType?.type !== "listed" || !customerType?.customerId) return;
  const customer = await customerModel.findById(customerType.customerId).session(session);
  if (!customer) return;
  customer.openingDues = Math.max(0, (customer.openingDues || 0) - amount);
  await customer.save({ session });
}

// Revert a previously-applied dues deduction (used on delete/update rollback).
async function revertCustomerDuesForReturn(customerType, amount, session) {
  if (customerType?.type !== "listed" || !customerType?.customerId) return;
  await customerModel.findByIdAndUpdate(
    customerType.customerId,
    { $inc: { openingDues: amount } },
    { session },
  );
}

// Record the refund as an outgoing cash transaction, describing whether it
// came from a listed customer's due balance or a walking customer.
async function recordReturnTransaction({ sale, returnDoc, refundMethod, session }) {
  const customerType = sale?.customerType;
  const isListed = customerType?.type === "listed";
  const customerLabel = isListed
    ? "listed customer"
    : (customerType?.walking?.customerName || "walking customer");

  const [transaction] = await CrateTransaction.create(
    [
      {
        date: returnDoc.date || new Date(),
        account: refundMethod,
        transactionDescription: `Sales return refund — invoice ${sale?.invoiceNumber || ""} (${customerLabel})`.trim(),
        voucherNumber: sale?.invoiceNumber || "",
        transactionType: "cash payment",
        amount: returnDoc.totalReturnAmount,
      },
    ],
    { session },
  );
  return transaction;
}

// @desc create a new sales return
exports.createSalesReturn = asynchandeler(async (req, res) => {
  const data = await validateSalesReturn(req);
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesReturn = await SalesReturn.create([data], { session });
    let returnDoc = salesReturn[0];

    // Populate the newly created document to verify immediately
    returnDoc = await SalesReturn.findById(returnDoc._id)
      .populate({
        path: "invoiceNumber",
        select: "-paymentMethod -searchItem",
      })
      .populate("refundMethod")
      .populate("allproduct.product")
      .populate("allproduct.variant")
      .session(session);

    // 1. Restock products and variants & Update Sales searchItem status
    const originalSale = await Sales.findById(data.invoiceNumber).session(session);
    if (!originalSale) {
      throw new customError("Original Sale not found", statusCodes.NOT_FOUND);
    }

    for (const item of data.allproduct) {
      // 1a. Stock Update
      if (item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stockVariant: item.quantity, salesReturnStock: item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity, salesReturnStock: item.quantity } },
          { session }
        );
      }

      // 1b. Update searchItem status in Sales
      const targetItem = originalSale.searchItem.find(si => 
        (item.variant ? si.variantId?.toString() === item.variant.toString() : si.productId?.toString() === item.product.toString())
      );
      if (targetItem) {
        targetItem.salesStatus = "return";
      }
    }

    // 2. Update original Sales record (increment return field + searchItem status)
    originalSale.return = (originalSale.return || 0) + data.totalReturnAmount;
    await originalSale.save({ session });

    // 3. Listed customer -> deduct from opening dues. Walking customer -> skip.
    await applyCustomerDuesForReturn(
      originalSale.customerType,
      data.totalReturnAmount,
      session,
    );

    // 4. Record the refund as a transaction either way, and link it back.
    const transaction = await recordReturnTransaction({
      sale: originalSale,
      returnDoc: data,
      refundMethod: data.refundMethod,
      session,
    });
    returnDoc.transaction = transaction._id;
    await SalesReturn.findByIdAndUpdate(
      returnDoc._id,
      { transaction: transaction._id },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // salesReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Sales Return created successfully",
      returnDoc
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

//@desc get all sales return
exports.getAllSalesReturn = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales Returns fetched successfully",
      { salesReturns: cached, fromCache: true }
    );
  }

  const salesReturns = await SalesReturn.find()
    .populate({
      path: "invoiceNumber",
      select: "-paymentMethod -searchItem",
    })
    .populate("refundMethod")
    .populate("allproduct.product")
    .populate("allproduct.variant")
    .sort({ createdAt: -1 })
    .lean();

  if (!salesReturns || salesReturns.length === 0) {
    throw new customError("No sales returns found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, salesReturns, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Returns fetched successfully",
    { salesReturns }
  );
});

//@desc get single sales return using ID
exports.getSingleSalesReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("ID is required", statusCodes.BAD_REQUEST);
  }

  const cacheKey = await buildCacheKey(NS, `id:${id}`);
  const cached = await getCache(cacheKey);
  
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales Return fetched successfully",
      { salesReturn: cached, fromCache: true }
    );
  }

  const salesReturn = await SalesReturn.findById(id)
    .populate({
      path: "invoiceNumber",
      select: "-paymentMethod -searchItem",
    })
    .populate("refundMethod")
    .populate("allproduct.product")
    .populate("allproduct.variant")
    .lean();

  if (!salesReturn) {
    throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, salesReturn, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales Return fetched successfully",
    { salesReturn }
  );
});

// @desc delete sales return
exports.deleteSalesReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesReturn = await SalesReturn.findById(id).session(session);
    if (!salesReturn) {
      throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
    }

    const originalSale = await Sales.findById(salesReturn.invoiceNumber).session(session);
    
    // 1. Rollback Restock & Reset Sales searchItem status
    for (const item of salesReturn.allproduct) {
      // 1a. Decrease stock
      if (item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stockVariant: -item.quantity, salesReturnStock: -item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity, salesReturnStock: -item.quantity } },
          { session }
        );
      }

      // 1b. Reset status to "sale"
      if (originalSale) {
        const targetItem = originalSale.searchItem.find(si => 
          (item.variant ? si.variantId?.toString() === item.variant.toString() : si.productId?.toString() === item.product.toString())
        );
        if (targetItem) {
          targetItem.salesStatus = "sale";
        }
      }
    }

    // 2. Rollback Sales record (decrement return field)
    if (originalSale) {
      originalSale.return = Math.max(0, (originalSale.return || 0) - salesReturn.totalReturnAmount);
      await originalSale.save({ session });
    }

    // 3. Rollback listed customer's opening dues and remove the refund transaction.
    if (originalSale) {
      await revertCustomerDuesForReturn(
        originalSale.customerType,
        salesReturn.totalReturnAmount,
        session,
      );
    }
    if (salesReturn.transaction) {
      await CrateTransaction.findByIdAndDelete(salesReturn.transaction, { session });
    }

    await SalesReturn.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // salesReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales Return deleted successfully",
      null
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// @desc update sales return
exports.updateSalesReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const data = await validateSalesReturn(req);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingReturn = await SalesReturn.findById(id).session(session);
    if (!existingReturn) {
      throw new customError("Sales Return not found", statusCodes.NOT_FOUND);
    }

    const oldSale = await Sales.findById(existingReturn.invoiceNumber).session(session);
    const newSale = await Sales.findById(data.invoiceNumber).session(session);

    // --- STEP 1: REVERT OLD STATE ---

    // 1a. Revert old stock
    for (const item of existingReturn.allproduct) {
      if (item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stockVariant: -item.quantity, salesReturnStock: -item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity, salesReturnStock: -item.quantity } },
          { session }
        );
      }

      // 1b. Reset old salesStatus
      if (oldSale) {
        const targetItem = oldSale.searchItem.find(si => 
          (item.variant ? si.variantId?.toString() === item.variant.toString() : si.productId?.toString() === item.product.toString())
        );
        if (targetItem) targetItem.salesStatus = "sale";
      }
    }

    // 1c. Revert old Sales return amount
    if (oldSale) {
      oldSale.return = Math.max(0, (oldSale.return || 0) - existingReturn.totalReturnAmount);
      await oldSale.save({ session });
    }

    // 1d. Revert old listed customer's opening dues
    if (oldSale) {
      await revertCustomerDuesForReturn(
        oldSale.customerType,
        existingReturn.totalReturnAmount,
        session,
      );
    }

    // --- STEP 2: APPLY NEW STATE ---

    // 2a. Apply new stock
    for (const item of data.allproduct) {
      if (item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stockVariant: item.quantity, salesReturnStock: item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity, salesReturnStock: item.quantity } },
          { session }
        );
      }

      // 2b. Set new salesStatus
      if (newSale) {
        const targetItem = newSale.searchItem.find(si => 
          (item.variant ? si.variantId?.toString() === item.variant.toString() : si.productId?.toString() === item.product.toString())
        );
        if (targetItem) targetItem.salesStatus = "return";
      }
    }

    // 2c. Apply new Sales return amount
    if (newSale) {
      newSale.return = (newSale.return || 0) + data.totalReturnAmount;
      await newSale.save({ session });
    }

    // 2d. Apply new listed customer's opening dues
    if (newSale) {
      await applyCustomerDuesForReturn(
        newSale.customerType,
        data.totalReturnAmount,
        session,
      );
    }

    // 2e. Update (or create) the linked refund transaction to match the new state
    let transactionId = existingReturn.transaction;
    if (transactionId) {
      const isListed = newSale?.customerType?.type === "listed";
      const customerLabel = isListed
        ? "listed customer"
        : (newSale?.customerType?.walking?.customerName || "walking customer");
      await CrateTransaction.findByIdAndUpdate(
        transactionId,
        {
          date: data.date || new Date(),
          account: data.refundMethod,
          transactionDescription: `Sales return refund — invoice ${newSale?.invoiceNumber || ""} (${customerLabel})`.trim(),
          voucherNumber: newSale?.invoiceNumber || "",
          transactionType: "cash payment",
          amount: data.totalReturnAmount,
        },
        { session },
      );
    } else {
      const transaction = await recordReturnTransaction({
        sale: newSale,
        returnDoc: data,
        refundMethod: data.refundMethod,
        session,
      });
      transactionId = transaction._id;
    }

    // 3. Update the return document
    const updatedReturn = await SalesReturn.findByIdAndUpdate(
      id,
      { $set: { ...data, transaction: transactionId } },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);
    // Also bump product cache — this endpoint mutates stock/stockVariant and
    // salesReturnStock on Product/Variant, which /product/* endpoints cache.
    await bumpNsVersion("product");

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales Return updated successfully",
      updatedReturn
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
