const mongoose = require("mongoose");
const PurchaseReturn = require("../models/purchaseReturn.model");
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

const NS = "purchase-return";
const CACHE_TTL = 60 * 60;

// ─── helpers ─────────────────────────────────────────────────────────────────

function validatePayload(body) {
  const { supplier, products } = body;
  if (!supplier) {
    throw new customError("Supplier is required", statusCodes.BAD_REQUEST);
  }
  if (!mongoose.Types.ObjectId.isValid(supplier)) {
    throw new customError("Invalid supplier ID", statusCodes.BAD_REQUEST);
  }
  if (!Array.isArray(products) || products.length === 0) {
    throw new customError(
      "At least one product is required",
      statusCodes.BAD_REQUEST,
    );
  }
  for (const item of products) {
    if (!item.product && !item.variant) {
      throw new customError(
        "Each item must have a product or variant",
        statusCodes.BAD_REQUEST,
      );
    }
    if (!item.quantity || item.quantity < 1) {
      throw new customError(
        "Each item must have a quantity of at least 1",
        statusCodes.BAD_REQUEST,
      );
    }
    if (!item.purchasePrice || item.purchasePrice <= 0) {
      throw new customError(
        "Each item must have a valid purchasePrice",
        statusCodes.BAD_REQUEST,
      );
    }
  }
}

// ─── createPurchaseReturn ────────────────────────────────────────────────────

exports.createPurchaseReturn = asynchandeler(async (req, res) => {
  const { supplier, returnDate, remarks, products } = req.body;

  validatePayload(req.body);

  const productIds = [
    ...new Set(
      products.filter((i) => i.product).map((i) => i.product.toString()),
    ),
  ];
  const variantIds = [
    ...new Set(
      products.filter((i) => i.variant).map((i) => i.variant.toString()),
    ),
  ];

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Batch fetch — sequential on same session (Promise.all on one session corrupts txn counter)
    const supplierDoc = await SupplierModel.findById(supplier).session(session);
    const productDocs = productIds.length
      ? await Product.find({ _id: { $in: productIds } })
          .select("_id stock")
          .session(session)
      : [];
    const variantDocs = variantIds.length
      ? await Variant.find({ _id: { $in: variantIds } })
          .select("_id stockVariant")
          .session(session)
      : [];

    if (!supplierDoc) {
      throw new customError("Supplier not found", statusCodes.NOT_FOUND);
    }

    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p]),
    );
    const variantMap = Object.fromEntries(
      variantDocs.map((v) => [v._id.toString(), v]),
    );

    // Stock validation & subtotal calculation
    let totalReturnAmount = 0;
    const returnProducts = [];

    for (const item of products) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);

      if (item.variant) {
        const v = variantMap[item.variant.toString()];
        if (!v) {
          throw new customError(
            `Variant ${item.variant} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (v.stockVariant < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available variant stock (${v.stockVariant})`,
            statusCodes.BAD_REQUEST,
          );
        }
      } else {
        const p = productMap[item.product.toString()];
        if (!p) {
          throw new customError(
            `Product ${item.product} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (p.stock < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available product stock (${p.stock})`,
            statusCodes.BAD_REQUEST,
          );
        }
      }

      const subtotal = price * qty;
      totalReturnAmount += subtotal;

      returnProducts.push({
        product: item.product || null,
        variant: item.variant || null,
        quantity: qty,
        purchasePrice: price,
        subtotal,
      });
    }

    // Create the return document
    const [purchaseReturn] = await PurchaseReturn.create(
      [
        {
          supplier,
          returnDate: returnDate || Date.now(),
          remarks: remarks || "",
          totalReturnAmount,
          products: returnProducts,
        },
      ],
      { session },
    );

    // Bulk update product stock
    if (productIds.length) {
      const productOps = returnProducts
        .filter((i) => i.product)
        .map((i) => ({
          updateOne: {
            filter: { _id: i.product },
            update: {
              $inc: {
                stock: -i.quantity,
                purchaseReturnStock: i.quantity,
              },
            },
          },
        }));
      if (productOps.length) {
        await Product.bulkWrite(productOps, { session });
      }
    }

    // Bulk update variant stock
    if (variantIds.length) {
      const variantOps = returnProducts
        .filter((i) => i.variant)
        .map((i) => ({
          updateOne: {
            filter: { _id: i.variant },
            update: {
              $inc: {
                stockVariant: -i.quantity,
                purchaseReturnStock: i.quantity,
              },
            },
          },
        }));
      if (variantOps.length) {
        await Variant.bulkWrite(variantOps, { session });
      }
    }

    // Update supplier dues
    supplierDoc.openingDues = Math.max(
      0,
      (supplierDoc.openingDues || 0) - totalReturnAmount,
    );
    supplierDoc.totalPurchaseDue = Math.max(
      0,
      (supplierDoc.totalPurchaseDue || 0) - totalReturnAmount,
    );
    await supplierDoc.save({ session });

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Purchase return created successfully",
      purchaseReturn,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// ─── getPurchaseReturn ───────────────────────────────────────────────────────

exports.getPurchaseReturn = asynchandeler(async (req, res) => {
  const {
    supplierId,
    supplierName,
    productName,
    variantName,
    returnDate,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = req.query;

  const isSearch =
    supplierId || supplierName || productName || variantName || returnDate || startDate || endDate;

  // Only use cache for plain list (no filters)
  if (!isSearch) {
    const cacheKey = await buildCacheKey(
      NS,
      `list:page=${page}:limit=${limit}:sort=${sort}`,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Purchase returns fetched successfully",
        { ...cached, fromCache: true },
      );
    }
  }

  const filter = {};

  // Supplier filter
  if (supplierId) {
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new customError("Invalid supplierId", statusCodes.BAD_REQUEST);
    }
    filter.supplier = supplierId;
  } else if (supplierName) {
    const matched = await SupplierModel.find({
      supplierName: { $regex: supplierName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter.supplier = { $in: matched.map((s) => s._id) };
  }

  // Product/Variant name filter (find matching IDs first)
  if (productName) {
    const matchedProducts = await Product.find({
      name: { $regex: productName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter["products.product"] = { $in: matchedProducts.map((p) => p._id) };
  }

  if (variantName) {
    const matchedVariants = await Variant.find({
      variantName: { $regex: variantName.trim(), $options: "i" },
    })
      .select("_id")
      .lean();
    filter["products.variant"] = { $in: matchedVariants.map((v) => v._id) };
  }

  // Date filters
  if (returnDate) {
    const day = new Date(returnDate);
    const next = new Date(returnDate);
    next.setDate(next.getDate() + 1);
    filter.returnDate = { $gte: day, $lt: next };
  } else if (startDate || endDate) {
    filter.returnDate = {};
    if (startDate) filter.returnDate.$gte = new Date(startDate);
    if (endDate) filter.returnDate.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [purchaseReturns, total] = await Promise.all([
    PurchaseReturn.find(filter)
      .populate("supplier", "supplierName supplierId mobile openingDues totalPurchaseDue")
      .populate("products.product", "name stock purchaseReturnStock barCode")
      .populate("products.variant", "variantName stockVariant purchaseReturnStock barCode size color")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PurchaseReturn.countDocuments(filter),
  ]);

  if (!purchaseReturns.length) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return not found",
      {
        purchaseReturns: [],
        total: 0,
        page: Number(page),
        totalPages: 0,
        fromCache: false,
      },
    );
  }

  const result = {
    purchaseReturns,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    fromCache: false,
  };

  if (!isSearch) {
    const cacheKey = await buildCacheKey(
      NS,
      `list:page=${page}:limit=${limit}:sort=${sort}`,
    );
    await setCache(cacheKey, result, CACHE_TTL);
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase returns fetched successfully",
    result,
  );
});

// ─── getSinglePurchaseReturn ─────────────────────────────────────────────────

exports.getSinglePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  const cacheKey = await buildCacheKey(NS, `id:${id}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return fetched successfully",
      { purchaseReturn: cached, fromCache: true },
    );
  }

  const purchaseReturn = await PurchaseReturn.findById(id)
    .populate("supplier", "supplierName supplierId mobile openingDues totalPurchaseDue")
    .populate("products.product", "name stock purchaseReturnStock barCode")
    .populate("products.variant", "variantName stockVariant purchaseReturnStock barCode size color")
    .lean();

  if (!purchaseReturn) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return not found",
      { purchaseReturn: null, fromCache: false },
    );
  }

  await setCache(cacheKey, purchaseReturn, CACHE_TTL);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Purchase return fetched successfully",
    { purchaseReturn, fromCache: false },
  );
});

// ─── updatePurchaseReturn ────────────────────────────────────────────────────

exports.updatePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const { supplier, returnDate, remarks, products } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  validatePayload(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existing = await PurchaseReturn.findById(id).session(session);
    if (!existing) {
      throw new customError("Purchase return not found", statusCodes.NOT_FOUND);
    }

    const oldSupplier = await SupplierModel.findById(
      existing.supplier,
    ).session(session);

    // ── STEP 1: Revert old stock ────────────────────────────────────────────

    const oldProductOps = existing.products
      .filter((i) => i.product)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product },
          update: {
            $inc: {
              stock: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    const oldVariantOps = existing.products
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant },
          update: {
            $inc: {
              stockVariant: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    if (oldProductOps.length) {
      await Product.bulkWrite(oldProductOps, { session });
    }
    if (oldVariantOps.length) {
      await Variant.bulkWrite(oldVariantOps, { session });
    }

    // Revert old supplier dues
    if (oldSupplier) {
      oldSupplier.openingDues =
        (oldSupplier.openingDues || 0) + existing.totalReturnAmount;
      oldSupplier.totalPurchaseDue =
        (oldSupplier.totalPurchaseDue || 0) + existing.totalReturnAmount;
      await oldSupplier.save({ session });
    }

    // ── STEP 2: Validate new payload & fetch new docs ───────────────────────

    const newProductIds = [
      ...new Set(
        products.filter((i) => i.product).map((i) => i.product.toString()),
      ),
    ];
    const newVariantIds = [
      ...new Set(
        products.filter((i) => i.variant).map((i) => i.variant.toString()),
      ),
    ];

    const newProductDocs = newProductIds.length
      ? await Product.find({ _id: { $in: newProductIds } })
          .select("_id stock")
          .session(session)
      : [];
    const newVariantDocs = newVariantIds.length
      ? await Variant.find({ _id: { $in: newVariantIds } })
          .select("_id stockVariant")
          .session(session)
      : [];
    const newSupplierDoc =
      supplier !== existing.supplier.toString()
        ? await SupplierModel.findById(supplier).session(session)
        : oldSupplier;

    if (!newSupplierDoc) {
      throw new customError("New supplier not found", statusCodes.NOT_FOUND);
    }

    const newProductMap = Object.fromEntries(
      newProductDocs.map((p) => [p._id.toString(), p]),
    );
    const newVariantMap = Object.fromEntries(
      newVariantDocs.map((v) => [v._id.toString(), v]),
    );

    let totalReturnAmount = 0;
    const returnProducts = [];

    for (const item of products) {
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);

      if (item.variant) {
        const v = newVariantMap[item.variant.toString()];
        if (!v) {
          throw new customError(
            `Variant ${item.variant} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (v.stockVariant < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available variant stock (${v.stockVariant})`,
            statusCodes.BAD_REQUEST,
          );
        }
      } else {
        const p = newProductMap[item.product.toString()];
        if (!p) {
          throw new customError(
            `Product ${item.product} not found`,
            statusCodes.NOT_FOUND,
          );
        }
        if (p.stock < qty) {
          throw new customError(
            `Return quantity (${qty}) exceeds available product stock (${p.stock})`,
            statusCodes.BAD_REQUEST,
          );
        }
      }

      const subtotal = price * qty;
      totalReturnAmount += subtotal;
      returnProducts.push({
        product: item.product || null,
        variant: item.variant || null,
        quantity: qty,
        purchasePrice: price,
        subtotal,
      });
    }

    // ── STEP 3: Apply new stock ─────────────────────────────────────────────

    const newProductOps = returnProducts
      .filter((i) => i.product)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product },
          update: {
            $inc: {
              stock: -i.quantity,
              purchaseReturnStock: i.quantity,
            },
          },
        },
      }));

    const newVariantOps = returnProducts
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant },
          update: {
            $inc: {
              stockVariant: -i.quantity,
              purchaseReturnStock: i.quantity,
            },
          },
        },
      }));

    if (newProductOps.length) {
      await Product.bulkWrite(newProductOps, { session });
    }
    if (newVariantOps.length) {
      await Variant.bulkWrite(newVariantOps, { session });
    }

    // Apply new supplier dues
    newSupplierDoc.openingDues = Math.max(
      0,
      (newSupplierDoc.openingDues || 0) - totalReturnAmount,
    );
    newSupplierDoc.totalPurchaseDue = Math.max(
      0,
      (newSupplierDoc.totalPurchaseDue || 0) - totalReturnAmount,
    );
    await newSupplierDoc.save({ session });

    // ── STEP 4: Update the return document ─────────────────────────────────

    existing.supplier = supplier;
    existing.returnDate = returnDate || existing.returnDate;
    existing.remarks = remarks ?? existing.remarks;
    existing.products = returnProducts;
    existing.totalReturnAmount = totalReturnAmount;
    await existing.save({ session });

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return updated successfully",
      existing,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

// ─── deletePurchaseReturn ────────────────────────────────────────────────────

exports.deletePurchaseReturn = asynchandeler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new customError("Invalid ID", statusCodes.BAD_REQUEST);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchaseReturn = await PurchaseReturn.findById(id).session(session);
    if (!purchaseReturn) {
      throw new customError("Purchase return not found", statusCodes.NOT_FOUND);
    }

    // Revert stock
    const productOps = purchaseReturn.products
      .filter((i) => i.product)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.product },
          update: {
            $inc: {
              stock: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    const variantOps = purchaseReturn.products
      .filter((i) => i.variant)
      .map((i) => ({
        updateOne: {
          filter: { _id: i.variant },
          update: {
            $inc: {
              stockVariant: i.quantity,
              purchaseReturnStock: -i.quantity,
            },
          },
        },
      }));

    if (productOps.length) await Product.bulkWrite(productOps, { session });
    if (variantOps.length) await Variant.bulkWrite(variantOps, { session });

    // Revert supplier dues
    const supplierDoc = await SupplierModel.findById(
      purchaseReturn.supplier,
    ).session(session);
    if (supplierDoc) {
      supplierDoc.openingDues =
        (supplierDoc.openingDues || 0) + purchaseReturn.totalReturnAmount;
      supplierDoc.totalPurchaseDue =
        (supplierDoc.totalPurchaseDue || 0) + purchaseReturn.totalReturnAmount;
      await supplierDoc.save({ session });
    }

    await PurchaseReturn.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Purchase return deleted successfully",
      null,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
