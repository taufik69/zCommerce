const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const SalesReturn = require("../models/salesReturn.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Sales = require("../models/sales.model");
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

// @desc create a new sales return
exports.createSalesReturn = asynchandeler(async (req, res) => {
  const data = await validateSalesReturn(req);
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesReturn = await SalesReturn.create([data], { session });
    const returnDoc = salesReturn[0];

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
          { $inc: { stockVariant: item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
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

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

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
    .populate("invoiceNumber") // Ref to Sales
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
    .populate("invoiceNumber")
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
          { $inc: { stockVariant: -item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } },
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

    await SalesReturn.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

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
          { $inc: { stockVariant: -item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } },
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

    // --- STEP 2: APPLY NEW STATE ---

    // 2a. Apply new stock
    for (const item of data.allproduct) {
      if (item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stockVariant: item.quantity } },
          { session }
        );
      } else if (item.product) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
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

    // 3. Update the return document
    const updatedReturn = await SalesReturn.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

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
