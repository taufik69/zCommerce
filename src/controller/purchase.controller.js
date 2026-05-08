const mongoose = require("mongoose");
const Purchase = require("../models/purchase.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { SupplierModel } = require("../models/supplier.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "purchase";
const CACHE_TTL = 60 * 60; // 1 hour

exports.createPurchase = asynchandeler(async (req, res) => {
  const {
    invoiceNumber,
    supplierId,
    cashType,
    allproduct,
    commission = 0,
    shipping = 0,
    paid = 0,
    category,
    subCategory,
    brand,
  } = req.body;

  if (!allproduct || !Array.isArray(allproduct) || allproduct.length === 0) {
    throw new customError(
      "At least one product or variant is required",
      statusCodes.BAD_REQUEST,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let subTotal = 0;
    const purchaseProducts = [];

    for (const item of allproduct) {
      const {
        product,
        variant,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        quantity,
        size,
        color,
      } = item;

      if (!purchasePrice || !retailPrice || !quantity) continue;

      const subTotalItem = purchasePrice * quantity;
      subTotal += subTotalItem;

      purchaseProducts.push({
        product: product || null,
        variant: variant || null,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        subTotal: subTotalItem,
        quantity,
        size: size || null,
        color: color || null,
      });

      if (product) {
        const productInfo = await Product.findById(product).session(session);
        if (productInfo) {
          productInfo.stock = (productInfo.stock || 0) + quantity;
          productInfo.wholesalePrice = wholesalePrice;
          productInfo.purchasePrice = purchasePrice;
          productInfo.retailPrice = retailPrice;
          if (size) productInfo.size = size;
          if (color) productInfo.color = color;
          await productInfo.save({ session });
        }
      }

      if (variant) {
        const variantInfo = await Variant.findById(variant).session(session);
        if (variantInfo) {
          variantInfo.stockVariant = (variantInfo.stockVariant || 0) + quantity;
          variantInfo.wholesalePrice = wholesalePrice;
          variantInfo.purchasePrice = purchasePrice;
          variantInfo.retailPrice = retailPrice;
          if (size) variantInfo.size = size;
          if (color) variantInfo.color = color;
          await variantInfo.save({ session });
        }
      }
    }

    const payable = subTotal + shipping + commission;
    const dueamount = payable - paid;

    if (supplierId && dueamount !== 0) {
      // Find supplier by _id first, then by supplierId (mobile number) if not found
      let supplier = await SupplierModel.findById(supplierId).session(session);
      if (!supplier) {
        supplier = await SupplierModel.findOne({ supplierId }).session(session);
      }

      if (supplier) {
        supplier.openingDues =  dueamount;
        await supplier.save({ session });
        
        // Ensure we store the mobile number supplierId in the purchase record 
        // for compatibility with aggregation lookups
        req.body.supplierId = supplier.supplierId;
      }
    }

    const [purchase] = await Purchase.create(
      [
        {
          invoiceNumber,
          supplierId,
          cashType,
          allproduct: purchaseProducts,
          subTotal,
          commission,
          shipping,
          payable,
          paid,
          dueamount,
          category,
          subCategory,
          brand,
          ...req.body,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Purchase created successfully",
      purchase,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// get all purchases
exports.getAllPurchases = asynchandeler(async (req, res) => {
  const cacheKey = await buildCacheKey(NS, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchases fetched successfully",
      { purchases: cached, fromCache: true },
    );
  }

  const purchases = await Purchase.find()
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
    })
    .populate("category subCategory brand cashType")
    .sort({ createdAt: -1 })
    .lean();

  if (!purchases || purchases.length === 0) {
    throw new customError("Purchases not found", statusCodes.NOT_FOUND);
  }

  const purchasesWithSerial = purchases.map((p, index) => {
    const serialNumber = (index + 1).toString().padStart(2, "0");
    return {
      serial: `PUR-SI-${serialNumber}`,
      ...p,
    };
  });

  await setCache(cacheKey, purchasesWithSerial, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchases fetched successfully",
    purchasesWithSerial,
  );
});

// get single product using slug
exports.getSinglePurchase = asynchandeler(async (req, res) => {
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
      "Purchase fetched successfully",
      { purchase: cached, fromCache: true },
    );
  }

  const purchase = await Purchase.findById(id)
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
    })
    .populate("category subCategory brand cashType")
    .lean();

  if (!purchase) {
    throw new customError("Purchase not found", statusCodes.NOT_FOUND);
  }

  await setCache(cacheKey, purchase, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase fetched successfully",
    purchase,
  );
});

// update purchase
exports.updatePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const {
    invoiceNumber,
    supplierId,
    cashType,
    allproduct,
    commission = 0,
    shipping = 0,
    paid = 0,
    category,
    subCategory,
    brand,
  } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingPurchase = await Purchase.findById(id).session(session);
    if (!existingPurchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Revert Old Stock using $inc for efficiency and atomicity
    for (const item of existingPurchase.allproduct) {
      const { product, variant, quantity } = item;
      if (product) {
        await Product.findByIdAndUpdate(product, { $inc: { stock: -quantity } }).session(session);
      }
      if (variant) {
        await Variant.findByIdAndUpdate(variant, { $inc: { stockVariant: -quantity } }).session(session);
      }
    }

    // Revert Old Supplier Dues (Subtract the old due amount from supplier balance)
    if (existingPurchase.supplierId && existingPurchase.dueamount !== 0) {
      const oldSupplier = await SupplierModel.findOne({ supplierId: existingPurchase.supplierId }).session(session);
      if (oldSupplier) {
        oldSupplier.openingDues = Math.max(0, (oldSupplier.openingDues || 0) - existingPurchase.dueamount);
        await oldSupplier.save({ session });
      }
    }

    // Apply New Products & Stock
    let subTotal = 0;
    const updatedProducts = [];

    for (const item of allproduct) {
      const {
        product,
        variant,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        quantity,
        size,
        color,
      } = item;

      if (!purchasePrice || !retailPrice || !quantity) continue;

      const subTotalItem = purchasePrice * quantity;
      subTotal += subTotalItem;

      updatedProducts.push({
        product: product || null,
        variant: variant || null,
        purchasePrice,
        retailPrice,
        wholesalePrice,
        subTotal: subTotalItem,
        quantity,
        size: size || null,
        color: color || null,
      });

      if (product) {
        const productInfo = await Product.findById(product).session(session);
        if (productInfo) {
          productInfo.stock = (productInfo.stock || 0) + quantity;
          productInfo.wholesalePrice = wholesalePrice;
          productInfo.purchasePrice = purchasePrice;
          productInfo.retailPrice = retailPrice;
          if (size) productInfo.size = size;
          if (color) productInfo.color = color;
          await productInfo.save({ session });
        }
      }

      if (variant) {
        const variantInfo = await Variant.findById(variant).session(session);
        if (variantInfo) {
          variantInfo.stockVariant = (variantInfo.stockVariant || 0) + quantity;
          variantInfo.wholesalePrice = wholesalePrice;
          variantInfo.purchasePrice = purchasePrice;
          variantInfo.retailPrice = retailPrice;
          if (size) variantInfo.size = size;
          if (color) variantInfo.color = color;
          await variantInfo.save({ session });
        }
      }
    }

    const payable = subTotal + shipping + commission;
    const dueamount = payable - paid;

    // Apply New Supplier Dues
    if (supplierId && dueamount !== 0) {
      let supplier = await SupplierModel.findById(supplierId).session(session);
      if (!supplier) {
        supplier = await SupplierModel.findOne({ supplierId }).session(session);
      }
      
      if (supplier) {
        supplier.openingDues = (supplier.openingDues || 0) + dueamount;
        await supplier.save({ session });
        // Use the supplier mobile number for the purchase record
        req.body.supplierId = supplier.supplierId;
      }
    }

    // Update Purchase Document
    existingPurchase.invoiceNumber = invoiceNumber || existingPurchase.invoiceNumber;
    existingPurchase.supplierId = req.body.supplierId || existingPurchase.supplierId;
    existingPurchase.cashType = cashType || existingPurchase.cashType;
    existingPurchase.allproduct = updatedProducts;
    existingPurchase.subTotal = subTotal;
    existingPurchase.commission = commission;
    existingPurchase.shipping = shipping;
    existingPurchase.payable = payable;
    existingPurchase.paid = paid;
    existingPurchase.dueamount = dueamount;
    existingPurchase.category = category || existingPurchase.category;
    existingPurchase.subCategory = subCategory || existingPurchase.subCategory;
    existingPurchase.brand = brand || existingPurchase.brand;

    await existingPurchase.save({ session });

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase updated successfully",
      existingPurchase,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// delete purchase
exports.deletePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) {
      throw new customError("Purchase not found", statusCodes.NOT_FOUND);
    }

    // Rollback Stock
    for (const item of purchase.allproduct) {
      const { product, variant, quantity } = item;
      if (product) {
        await Product.findByIdAndUpdate(product, { $inc: { stock: -quantity } }).session(session);
      }
      if (variant) {
        await Variant.findByIdAndUpdate(variant, { $inc: { stockVariant: -quantity } }).session(session);
      }
    }

    // Rollback Supplier Dues
    if (purchase.supplierId && purchase.dueamount !== 0) {
      const supplier = await SupplierModel.findOne({ supplierId: purchase.supplierId }).session(session);
      if (supplier) {
        supplier.openingDues = Math.max(0, (supplier.openingDues || 0) - purchase.dueamount);
        await supplier.save({ session });
      }
    }

    await Purchase.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase deleted successfully",
      null,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
