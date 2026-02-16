const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const mongoose = require("mongoose");
const salesModel = require("../models/sales.model");
const { statusCodes } = require("../constant/constant");
const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const { sendSMS } = require("../helpers/sms");
const { sendEmail } = require("../helpers/nodemailer");
const { customerModel } = require("../models/customer.model");
const _ = require("../routes/api/sales.api");

// @desc create a new sales
// @desc create a new sales (transaction safe + background notifications)
exports.createSales = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();
  let createdSale;

  try {
    await session.withTransaction(async () => {
      // 1) Create sales (must be inside txn)
      const docs = await salesModel.create([req.body], { session });
      createdSale = docs[0];

      if (!createdSale) {
        throw new customError("Sales not created", statusCodes.SERVER_ERROR);
      }

      // 2) Build bulk stock operations (fast + atomic)
      const productOps = [];
      const variantOps = [];

      for (const item of createdSale.searchItem || []) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        // sale -> reduce stock, return -> increase stock
        const sign = item.salesStatus === "return" ? +1 : -1;
        const incBy = sign * qty;

        // Product
        if (item.productId) {
          // when reducing (incBy negative), ensure enough stock
          const filter =
            incBy < 0
              ? { _id: item.productId, stock: { $gte: Math.abs(incBy) } }
              : { _id: item.productId };

          productOps.push({
            updateOne: {
              filter,
              update: { $inc: { stock: incBy } },
            },
          });
        }

        // Variant
        if (item.variantId) {
          const filter =
            incBy < 0
              ? {
                  _id: item.variantId,
                  stockVariant: { $gte: Math.abs(incBy) },
                }
              : { _id: item.variantId };

          variantOps.push({
            updateOne: {
              filter,
              update: { $inc: { stockVariant: incBy } },
            },
          });
        }
      }

      // execute bulk updates inside txn
      if (productOps.length) {
        const result = await productModel.bulkWrite(productOps, { session });
        if (result.matchedCount !== productOps.length) {
          throw new customError(
            "Stock not enough for some items",
            statusCodes.SERVER_ERROR,
          );
        }
      }

      if (variantOps.length) {
        const result = await variantModel.bulkWrite(variantOps, { session });
        if (result.matchedCount !== variantOps.length) {
          throw new customError(
            "Stock not enough for some items",
            statusCodes.SERVER_ERROR,
          );
        }
      }
    });

    // commit done; rollback already handled automatically if error thrown
    session.endSession();

    // 3) Background notifications (AFTER commit)
    if (createdSale?.sendSms) {
      setImmediate(async () => {
        try {
          const customerType = createdSale.customerType;

          let phone = "";
          let email = "";
          let name = "";
          let address = "";

          if (customerType?.type === "walking") {
            name = customerType?.walking?.customerName || "";
            phone = customerType?.walking?.mobileNumber || "";
            email = customerType?.walking?.email || "";
            address = customerType?.walking?.address || "";
          } else {
            // listed customer id is customerType.listed.customerId
            const customerId = customerType?.customerId;

            const customer = await customerModel.findById(customerId).lean();
            if (!customer) {
              throw new customError(
                "Customer not found",
                statusCodes.NOT_FOUND,
              );
            }

            name = customer.fullName || "";
            phone = customer.mobileNumber || "";
            email = customer.emailAddress || customer.email || "";
            address = customer.presentAddress || "";
          }

          if (!phone) {
            console.log("SMS skipped: phone missing");
            return;
          }

          const msgContent =
            `Customer Name: ${name}\n` +
            `Mobile Number: ${phone}\n` +
            (email ? `Email: ${email}\n` : "") +
            (address ? `Address: ${address}\n` : "") +
            `Invoice: ${createdSale.invoiceNumber}`;

          // SMS: handle failure (do not crash request; it's background)
          try {
            const smsResult = await sendSMS(phone, msgContent);
            console.log("SMS sent:", smsResult);
          } catch (smsErr) {
            console.log("SMS failed:", smsErr);
          }

          // Email: fire-and-forget
          if (email) {
            sendEmail(email, "Order Confirmation", msgContent).catch((e) => {
              console.log("Email failed:", e);
            });
          }
        } catch (e) {
          console.log("Notification background error:", e);
        }
      });
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Sales created successfully",
      createdSale,
    );
  } catch (err) {
    session.endSession();
    throw err;
  }
});

// get all sales order or get invoiceNumber wise sales
exports.getAllSales = asynchandeler(async (req, res) => {
  const { invoiceNumber } = req.query;
  let query = {};
  if (invoiceNumber) {
    query = { invoiceNumber };
  } else {
    query = {};
  }
  const sales = await salesModel
    .find(query)
    .sort({ createdAt: -1 })
    .populate("customerType.customerId")
    .populate("searchItem.productId")
    .populate("searchItem.variantId");
  if (!sales || sales.length === 0) {
    throw new customError("No sales found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales fetched successfully",
    sales,
  );
});

// search by product name or barCode  sku and search also variant model variantName

exports.searchProductsAndVariants = async (req, res) => {
  const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit || 20), 50);

    if (!q) {
      return apiResponse.sendError(
        res,
        statusCodes.BAD_REQUEST,
        "Query (q) is required",
      );
    }

    // barcode/sku usually numeric-ish (but keep generic)
    const isLikelyCode = /^[0-9A-Za-z\-_.]{4,}$/.test(q);
    const qRegex = new RegExp(escapeRegex(q), "i");

    // ---------- Product match ----------
    // code => exact match prefer
    const productMatch = isLikelyCode
      ? {
          $or: [
            { sku: q },
            { barCode: q },
            { qrCode: q },
            { slug: q.toLowerCase?.() || q },
          ],
        }
      : {
          $or: [
            { name: qRegex },
            { slug: q.toLowerCase?.() || q },
            { sku: qRegex },
            { barCode: qRegex },
          ],
        };

    // ---------- Variant match ----------
    const variantMatch = isLikelyCode
      ? {
          $or: [
            { sku: q },
            { barCode: q },
            { qrCode: q },
            { slug: q.toLowerCase?.() || q },
          ],
        }
      : {
          $or: [
            { variantName: qRegex },
            { slug: q.toLowerCase?.() || q },
            { sku: qRegex },
            { barCode: qRegex },
          ],
        };

    // One pipeline: products + variants
    const results = await productModel.aggregate([
      { $match: productMatch },

      // score boost for exact code matches (optional)
      {
        $addFields: {
          _type: "product",
          _score: {
            $cond: [
              {
                $or: [
                  { $eq: ["$sku", q] },
                  { $eq: ["$barCode", q] },
                  { $eq: ["$qrCode", q] },
                ],
              },
              100,
              10,
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          _type: 1,
          _score: 1,
          name: 1,
          slug: 1,
          sku: 1,
          barCode: 1,
          groupUnit: 1,
          groupUnitQuantity: 1,
          unit: 1,
          qrCode: 1,
          image: 1,
          stock: 1,
          size: 1,
          color: 1,
          purchasePrice: 1,
          retailPrice: 1,
          wholesalePrice: 1,
          totalSales: 1,
          slug: 1,
        },
      },

      // union variants
      {
        $unionWith: {
          coll: variantModel.collection.name, // "variants"
          pipeline: [
            { $match: variantMatch },
            {
              $addFields: {
                _type: "variant",
                _score: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$sku", q] },
                        { $eq: ["$barCode", q] },
                        { $eq: ["$qrCode", q] },
                      ],
                    },
                    100,
                    10,
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                _type: 1,
                _score: 1,
                product: 1,
                variantName: 1,
                slug: 1,
                sku: 1,
                barCode: 1,
                qrCode: 1,
                image: 1,
                stockVariant: 1,
                purchasePrice: 1,
                retailPrice: 1,
                totalSales: 1,
                wholesalePrice: 1,
                size: 1,
                color: 1,
              },
            },
          ],
        },
      },

      // sort best matches first
      { $sort: { _score: -1, _id: -1 } },
      { $limit: limit },
    ]);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Search results",
      results,
    );
  } catch (err) {
    return apiResponse.sendError(res, statusCodes.SERVER_ERROR, err.message);
  }
};

// update sales
exports.updateSales = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();
  let updatedSale;

  try {
    await session.withTransaction(async () => {
      const saleId = req.params.saleId;
      console.log(saleId);

      // 1) Load old sale inside transaction
      const oldSale = await salesModel.findById(saleId).session(session).lean();
      if (!oldSale) {
        throw new customError("Sales not found", statusCodes.NOT_FOUND);
      }

      // 2) Decide NEW state (if field not sent, keep old)
      const newInvoiceStatus = req.body.invoiceStatus ?? oldSale.invoiceStatus;
      const newItems = req.body.searchItem ?? oldSale.searchItem ?? [];
      const oldItems = oldSale.searchItem ?? [];

      const oldIsComplete = oldSale.invoiceStatus === "complete";
      const newIsComplete = newInvoiceStatus === "complete";

      // helpers
      const effectQty = (it) => {
        const qty = Number(it?.quantity || 0);
        if (qty <= 0) return 0;
        // sale -> reduce (-), return -> increase (+)
        return (it.salesStatus === "return" ? +1 : -1) * qty;
      };

      const addToMap = (map, id, val) => {
        if (!id || !val) return;
        const key = String(id);
        map.set(key, (map.get(key) || 0) + val);
      };

      const buildEffectMaps = (items) => {
        const productMap = new Map();
        const variantMap = new Map();

        for (const it of items || []) {
          const eff = effectQty(it);
          addToMap(productMap, it.productId, eff);
          addToMap(variantMap, it.variantId, eff);
        }

        return { productMap, variantMap };
      };

      // 3) Determine stock delta maps based on invoiceStatus transitions
      // delta = what to apply to stock NOW
      let productDelta = new Map();
      let variantDelta = new Map();

      if (oldIsComplete && newIsComplete) {
        // diff = new - old
        const oldMaps = buildEffectMaps(oldItems);
        const newMaps = buildEffectMaps(newItems);

        const mergeDelta = (newMap, oldMap) => {
          const out = new Map();
          const ids = new Set([...newMap.keys(), ...oldMap.keys()]);
          for (const id of ids) {
            const n = newMap.get(id) || 0;
            const o = oldMap.get(id) || 0;
            const d = n - o;
            if (d !== 0) out.set(id, d);
          }
          return out;
        };

        productDelta = mergeDelta(newMaps.productMap, oldMaps.productMap);
        variantDelta = mergeDelta(newMaps.variantMap, oldMaps.variantMap);
      } else if (!oldIsComplete && newIsComplete) {
        // apply FULL new effect (since previously no stock was applied)
        const newMaps = buildEffectMaps(newItems);
        productDelta = newMaps.productMap;
        variantDelta = newMaps.variantMap;
      } else if (oldIsComplete && !newIsComplete) {
        // revert FULL old effect (undo what was applied before)
        const oldMaps = buildEffectMaps(oldItems);

        // revert means: delta = -oldEffect
        productDelta = new Map(
          [...oldMaps.productMap.entries()].map(([id, v]) => [id, -v]),
        );
        variantDelta = new Map(
          [...oldMaps.variantMap.entries()].map(([id, v]) => [id, -v]),
        );
      }
      // else: !oldComplete && !newComplete => do nothing (no stock ops)

      // 4) Build bulk operations (with stock check on reductions)
      const productOps = [];
      for (const [productId, d] of productDelta.entries()) {
        if (!d) continue;
        const reduce = d < 0;
        const filter = reduce
          ? { _id: productId, stock: { $gte: Math.abs(d) } }
          : { _id: productId };

        productOps.push({
          updateOne: { filter, update: { $inc: { stock: d } } },
        });
      }

      const variantOps = [];
      for (const [variantId, d] of variantDelta.entries()) {
        if (!d) continue;
        const reduce = d < 0;
        const filter = reduce
          ? { _id: variantId, stockVariant: { $gte: Math.abs(d) } }
          : { _id: variantId };

        variantOps.push({
          updateOne: { filter, update: { $inc: { stockVariant: d } } },
        });
      }

      // 5) Execute stock updates FIRST (only if needed)
      if (productOps.length) {
        const r = await productModel.bulkWrite(productOps, { session });
        if (r.matchedCount !== productOps.length) {
          throw new customError(
            "Product stock not enough for some items",
            statusCodes.BAD_REQUEST,
          );
        }
      }

      if (variantOps.length) {
        const r = await variantModel.bulkWrite(variantOps, { session });
        if (r.matchedCount !== variantOps.length) {
          throw new customError(
            "Variant stock not enough for some items",
            statusCodes.BAD_REQUEST,
          );
        }
      }

      // 6) Now update the sales doc (inside same transaction)
      // NOTE: if user didn't send invoiceStatus/searchItem we already handled stock using old values,
      // and $set will only change what they sent.
      updatedSale = await salesModel.findByIdAndUpdate(
        saleId,
        { $set: req.body },
        { new: true, session, runValidators: true },
      );

      if (!updatedSale) {
        throw new customError("Sales update failed", statusCodes.SERVER_ERROR);
      }
    });

    session.endSession();

    // 7) Post-commit notifications (optional, same style as your createSales)
    if (updatedSale?.sendSms) {
      setImmediate(async () => {
        try {
          // const msgContent =
          //   `Customer Name: ${updatedSale.name}\n` +
          //   `Mobile Number: ${phone}\n` +
          //   (email ? `Email: ${email}\n` : "") +
          //   (address ? `Address: ${address}\n` : "") +
          //   `Invoice: ${updatedSale.invoiceNumber}`;

          // const smsResult = await sendSMS(phone, msgContent);
          console.log("SMS sent:", updatedSale);
        } catch (e) {
          console.log("Notification background error:", e);
        }
      });
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales updated successfully",
      updatedSale,
    );
  } catch (err) {
    session.endSession();
    throw err;
  }
});

// delete  sales controller
exports.deleteSales = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const saleId = req.params.saleId;
      // 1️ Find sale inside transaction
      const sale = await salesModel.findById(saleId).session(session).lean();
      if (!sale) {
        throw new customError("Sales not found", statusCodes.NOT_FOUND);
      }

      const isComplete = sale.invoiceStatus === "complete";
      const items = sale.searchItem || [];

      // helper: effect
      const effectQty = (it) => {
        const qty = Number(it?.quantity || 0);
        if (qty <= 0) return 0;
        return (it.salesStatus === "return" ? +1 : -1) * qty;
      };

      // 2️ If complete → revert stock
      if (isComplete) {
        const productMap = new Map();
        const variantMap = new Map();

        const addToMap = (map, id, val) => {
          if (!id || !val) return;
          const key = String(id);
          map.set(key, (map.get(key) || 0) + val);
        };

        for (const it of items) {
          const eff = effectQty(it);
          if (!eff) continue;

          // revert means: delta = -eff
          const revertDelta = -eff;

          addToMap(productMap, it.productId, revertDelta);
          addToMap(variantMap, it.variantId, revertDelta);
        }

        // 3️⃣Build bulk ops
        const productOps = [];
        for (const [productId, d] of productMap.entries()) {
          const reduce = d < 0;

          const filter = reduce
            ? { _id: productId, stock: { $gte: Math.abs(d) } }
            : { _id: productId };

          productOps.push({
            updateOne: { filter, update: { $inc: { stock: d } } },
          });
        }

        const variantOps = [];
        for (const [variantId, d] of variantMap.entries()) {
          const reduce = d < 0;

          const filter = reduce
            ? { _id: variantId, stockVariant: { $gte: Math.abs(d) } }
            : { _id: variantId };

          variantOps.push({
            updateOne: { filter, update: { $inc: { stockVariant: d } } },
          });
        }

        // 4️ Execute stock revert
        if (productOps.length) {
          const r = await productModel.bulkWrite(productOps, { session });
          if (r.matchedCount !== productOps.length) {
            throw new customError(
              "Product stock revert failed",
              statusCodes.BAD_REQUEST,
            );
          }
        }

        if (variantOps.length) {
          const r = await variantModel.bulkWrite(variantOps, { session });
          if (r.matchedCount !== variantOps.length) {
            throw new customError(
              "Variant stock revert failed",
              statusCodes.BAD_REQUEST,
            );
          }
        }
      }

      // 5️ Delete sale
      await salesModel.findByIdAndDelete(saleId, { session });
    });

    session.endSession();

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales deleted successfully",
    );
  } catch (err) {
    session.endSession();
    throw err;
  }
});
