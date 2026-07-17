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
const {
  customerModel,
  customerAdvancePaymentModel,
} = require("../models/customer.model");
const StoreInformation = require("../models/storeInformation.model");
const { smsQueue } = require("../queues/sms.queue");
const { emailQueue } = require("../queues/email.queue");
const { buildInvoiceHtml } = require("../helpers/invoiceTemplate");
const SmsLog = require("../models/smsLog.model");
const { clientCommandMessageReg } = require("bullmq");
const {
  bumpNsVersion,
  buildCacheKey,
  getCache,
  setCache,
} = require("@/utils/cache.util");

const NS = "sales";

// Server-side discount-limit enforcement. The frontend disables discount fields
// and warns the seller, but a client can be bypassed, so the same rule is
// re-checked here from the trusted req.user.discountLimit.
//
// Rule: the seller's discountLimit caps the combined discount on a sale as a
// percentage of the gross line value. Item-level discounts (already carried
// from the product/variant) + the invoice-level discountPercent + lessTaka are
// all summed and expressed as one effective percentage. discountLimit === 0
// means "no limit" (consistent with the customer dueLimit convention).
// The cap applies to every user, including superadmins.
const enforceDiscountLimit = (user, body) => {
  const limit = Number(user?.discountLimit || 0);
  if (limit <= 0) return;

  const items = Array.isArray(body?.searchItem) ? body.searchItem : [];

  let gross = 0;
  let itemDiscount = 0;
  for (const it of items) {
    // Only sale lines contribute to a discount cap; returns/exchanges don't.
    if (it?.salesStatus && it.salesStatus !== "sale") continue;
    const rate = Number(it?.salesRate || 0);
    const qty = Number(it?.quantity || 0);
    gross += rate * qty;
    itemDiscount += Number(it?.discount || 0);
  }

  if (gross <= 0) return;

  const invoiceDiscount = (Number(body?.discountPercent || 0) / 100) * gross;
  const lessTaka = Number(body?.lessTaka || 0);

  const totalDiscount = itemDiscount + invoiceDiscount + lessTaka;
  const effectivePercent = (totalDiscount / gross) * 100;

  // Round to 2 dp to avoid rejecting on floating-point noise at the boundary.
  if (Math.round(effectivePercent * 100) / 100 > limit) {
    throw new customError(
      `Discount limit exceeded. Your limit is ${limit}% but this sale applies ${effectivePercent.toFixed(
        2,
      )}%.`,
      statusCodes.FORBIDDEN,
    );
  }
};

// Resolve the customer's phone + email from a sale, whether walking or listed.
const resolveCustomerContact = async (sale) => {
  const ct = sale.customerType || {};
  if (ct.type === "walking") {
    return {
      name: ct.walking?.customerName || "",
      phone: ct.walking?.mobileNumber || "",
      email: ct.walking?.email || "",
    };
  }
  const customer = await customerModel.findById(ct.customerId).lean();
  return {
    name: customer?.fullName || "",
    phone: customer?.mobileNumber || "",
    email: customer?.emailAddress || customer?.email || "",
  };
};

// Hand a sale's SMS + email off to their queues. The SMS is the short text
// receipt (per the store's template); the email carries the full HTML invoice
// mirroring the print design. Both are enqueued; the workers do the sending.
const enqueueSalesNotifications = async (createdSale) => {
  const { phone, email } = await resolveCustomerContact(createdSale);
  const store = await StoreInformation.findOne().lean();
  const storeName = store?.storeName || "";
  const hotline = store?.phone || "";

  const money = (v) => Number(v || 0).toFixed(2);

  // ── SMS (short text receipt) ──
  if (phone) {
    const smsText =
      `Dear Sir/Mam,\n\n` +
      `Thank you for shopping at ${storeName}. We truly appreciate your support and look forward to serving you again!\n\n` +
      `Invoice No: ${createdSale.invoiceNumber}\n` +
      `Total Payable: ${money(createdSale.payable)} Taka\n` +
      `Paid: ${money(createdSale.paid)} Taka\n` +
      `Due: ${money(createdSale.presentDue)}\n\n` +
      `${storeName}\n` +
      `HOTLINE: ${hotline}\n\n` +
      `If needed, you can return or exchange the product within 7 days. Thanks for shopping!`;

    // The SMS worker tracks delivery against an SmsLog, matching recipients by
    // array index — so create the log first, then enqueue with its id.
    const log = await SmsLog.create({
      type: "single",
      recipientType: "sales",
      message: smsText,
      totalCount: 1,
      status: "queued",
      recipients: [{ phone, status: "pending" }],
    });

    const job = await smsQueue.add(
      "send-sales-sms",
      {
        logId: log._id.toString(),
        message: smsText,
        recipients: [{ phone, index: 0 }],
      },
      { jobId: `sales-sms-${createdSale._id}` },
    );
    await SmsLog.updateOne({ _id: log._id }, { $set: { jobId: job.id } });
  }

  // ── Email (full HTML invoice) ──
  if (email) {
    // Re-fetch the sale fully populated so the invoice HTML has customer,
    // item and salesman details — the txn-created doc isn't populated.
    const populated = await salesModel
      .findById(createdSale._id)
      .populate("customerType.customerId")
      .populate("searchItem.productId")
      .populate("searchItem.variantId")
      .populate("salesMen")
      .populate("paymentMethod.singlePayment.paymentTo")
      .populate("paymentMethod.multiplePayment.paymentTo")
      .lean();

    const html = buildInvoiceHtml(populated || createdSale.toObject?.() || createdSale, store);

    await emailQueue.add(
      "send-sales-invoice",
      {
        to: email,
        subject: `Invoice ${createdSale.invoiceNumber} - ${storeName}`,
        html,
      },
      { jobId: `sales-email-${createdSale._id}` },
    );
  }
};

// @desc create a new sales
// @desc create a new sales (transaction safe + background notifications)
exports.createSales = asynchandeler(async (req, res) => {
  // Enforce the seller's discount limit and stamp who is accountable for it.
  enforceDiscountLimit(req.user, req.body);
  req.body.discountGivenBy = req.user?._id;

  const session = await mongoose.startSession();
  let createdSale;

  try {
    await session.withTransaction(async () => {
      // Create sales (must be inside txn)
      const docs = await salesModel.create([req.body], { session });
      createdSale = docs[0];

      if (!createdSale) {
        throw new customError("Sales not created", statusCodes.SERVER_ERROR);
      }

      // Stock is only committed for a completed sale. Pending/draft orders
      // (e.g. from the sale-order pages) save without touching stock, so they
      // can be created even when stock is short — the deduction happens later
      // when the order is marked complete via updateSales.
      const shouldApplyStock = createdSale.invoiceStatus === "complete";

      //  Build bulk stock operations (fast + atomic)
      const productOps = [];
      const variantOps = [];

      for (const item of shouldApplyStock ? createdSale.searchItem || [] : []) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        // sale -> reduce stock, return -> increase stock
        const sign = item.salesStatus === "return" ? +1 : -1;
        const incBy = sign * qty;
        // posSold moves opposite to the stock effect of a sale:
        // sale (-qty stock) -> +qty posSold, return (+qty stock) -> -qty posSold
        const posSoldIncBy = -incBy;

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
              update: { $inc: { stock: incBy, posSold: posSoldIncBy } },
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
              update: { $inc: { stockVariant: incBy, posSold: posSoldIncBy } },
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

      //  Update customer opening dues if listed
      if (
        createdSale.customerType?.type === "listed" &&
        createdSale.customerType?.customerId
      ) {
        await customerModel.findByIdAndUpdate(
          createdSale.customerType.customerId,
          { openingDues: req.body.balance || 0 },
          { session },
        );
      }

      // Adjust customer advance payment if applicable
      const advanceAdjust = Number(req.body.customerAdvancePaymentAdjust || 0);
      if (advanceAdjust > 0 && createdSale.customerType?.customerId) {
        const advanceDoc = await customerAdvancePaymentModel
          .findOne({ customer: createdSale.customerType.customerId })
          .session(session);
        if (!advanceDoc || advanceDoc.balance < advanceAdjust) {
          throw new customError(
            `Insufficient advance balance. Available: ${advanceDoc?.balance || 0}`,
            statusCodes.BAD_REQUEST,
          );
        }

        // Reduce paidAmount and update balance
        advanceDoc.paidAmount -= advanceAdjust;
        advanceDoc.balance -= advanceAdjust;

        // Reset rule: if balance becomes 0, reset paidAmount and advanceCashBack
        if (advanceDoc.balance === 0) {
          advanceDoc.paidAmount = 0;
          advanceDoc.advanceCashBack = 0;
        }

        await advanceDoc.save({ session });
      }
    });

    // commit done; rollback already handled automatically if error thrown
    session.endSession();

    // invalidate product/variant caches so stock & posSold changes are visible immediately
    await bumpNsVersion("product");
    await bumpNsVersion("variant");
    // and the sales list/invoice caches, so sales history shows this change
    await bumpNsVersion(NS);

    // 3) Background notifications (AFTER commit) — SMS and email are both
    // handed off to their BullMQ queues, so the request returns immediately and
    // the dedicated workers (worker:sms / worker:email) do the sending with
    // retries. Enqueue failures are logged but never fail the sale.
    if (createdSale?.sendSms) {
      try {
        await enqueueSalesNotifications(createdSale);
      } catch (e) {
        console.log("Notification enqueue error:", e.message);
      }
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
  const { invoiceNumber, search, salesType, invoiceStatus } = req.query;

  // Optional list filters. salesType (e.g. ?salesType=retailsaleorder) lets the
  // order-list pages fetch only their own rows; invoiceStatus (e.g.
  // ?invoiceStatus=draft) powers the draft-order list. Both can combine.
  const listFilter = {};
  if (salesType && String(salesType).trim())
    listFilter.salesType = String(salesType).trim();
  if (invoiceStatus && String(invoiceStatus).trim())
    listFilter.invoiceStatus = String(invoiceStatus).trim();

  // Exact invoice lookup — used by callers that need one specific invoice's full details
  if (invoiceNumber) {
    const cacheKey = await buildCacheKey(NS, `invoice:${invoiceNumber}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Sales fetched successfully",
        cached,
      );
    }

    const sales = await salesModel
      .find({ invoiceNumber })
      .sort({ createdAt: -1 })
      .populate("customerType.customerId")
      .populate("searchItem.productId")
      .populate("searchItem.variantId")
      .populate("salesMen")
      .populate("discountGivenBy", "name email discountLimit")
      .populate("paymentMethod.singlePayment.paymentTo")
      .populate("paymentMethod.multiplePayment.paymentTo");
    if (!sales || sales.length === 0) {
      throw new customError("No sales found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, sales, 300);
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales fetched successfully",
      sales,
    );
  }

  // Backward-compatible unpaginated list — existing callers expect a flat array
  if (!req.query.page && !req.query.limit && !search) {
    const filterSuffix = Object.keys(listFilter).length
      ? `all:${listFilter.salesType || "*"}:${listFilter.invoiceStatus || "*"}`
      : "all";
    const cacheKey = await buildCacheKey(NS, filterSuffix);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Sales fetched successfully",
        cached,
      );
    }

    const sales = await salesModel
      .find(listFilter)
      .sort({ createdAt: -1 })
      .populate("customerType.customerId")
      .populate("searchItem.productId")
      .populate("searchItem.variantId")
      .populate("discountGivenBy", "name email discountLimit");

    // A filtered list (e.g. an order page with no orders yet) legitimately
    // returns nothing — send an empty array instead of a 404 in that case.
    const payload = sales || [];
    await setCache(cacheKey, payload, 300);
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales fetched successfully",
      payload,
    );
  }

  // Paginated + searchable list — used by infinite-scroll dropdowns
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const query = search
    ? { invoiceNumber: { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};

  const cacheKey = await buildCacheKey(
    NS,
    `list:p${page}:l${limit}:s${search || ""}`,
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Sales fetched successfully",
      cached,
    );
  }

  const [sales, total] = await Promise.all([
    salesModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerType.customerId")
      .populate("searchItem.productId")
      .populate("searchItem.variantId")
      .populate("discountGivenBy", "name email discountLimit"),
    salesModel.countDocuments(query),
  ]);

  const payload = {
    sales,
    total,
    page,
    limit,
    hasNextPage: page * limit < total,
  };
  await setCache(cacheKey, payload, 300);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Sales fetched successfully",
    payload,
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

    const isLikelyCode = /^[0-9A-Za-z\-_.]{4,}$/.test(q);
    const qRegex = new RegExp(escapeRegex(q), "i");

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

    const results = await productModel.aggregate([
      { $match: productMatch },

      // product discount populate
      {
        $lookup: {
          from: "discounts",
          localField: "discount",
          foreignField: "_id",
          as: "discount",
        },
      },
      {
        $unwind: {
          path: "$discount",
          preserveNullAndEmptyArrays: true,
        },
      },

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
          discount: 1,
        },
      },

      {
        $unionWith: {
          coll: variantModel.collection.name,
          pipeline: [
            { $match: variantMatch },

            // variant discount populate
            {
              $lookup: {
                from: "discounts",
                localField: "discount",
                foreignField: "_id",
                as: "discount",
              },
            },
            {
              $unwind: {
                path: "$discount",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $lookup: {
                from: productModel.collection.name,
                localField: "product",
                foreignField: "_id",
                as: "productInfo",
              },
            },
            {
              $unwind: {
                path: "$productInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                _type: "variant",
                productName: "$productInfo.name",
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
                productName: 1,
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
                discount: 1,
                unit: 1,
                groupUnit: 1,
                groupUnitQuantity: 1,
              },
            },
          ],
        },
      },

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

      // 1) Load old sale inside transaction
      const oldSale = await salesModel.findById(saleId).session(session).lean();
      if (!oldSale) {
        throw new customError("Sales not found", statusCodes.NOT_FOUND);
      }

      // Enforce the seller's discount limit on the effective (merged) sale —
      // an update may only send some fields, so fall back to the stored values
      // for anything not supplied before checking the combined discount.
      enforceDiscountLimit(req.user, {
        searchItem: req.body.searchItem ?? oldSale.searchItem,
        discountPercent: req.body.discountPercent ?? oldSale.discountPercent,
        lessTaka: req.body.lessTaka ?? oldSale.lessTaka,
      });
      // Record who applied the discount on this edit.
      req.body.discountGivenBy = req.user?._id;

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
      // posSold moves opposite to the stock delta (stock down => posSold up)
      const productOps = [];
      for (const [productId, d] of productDelta.entries()) {
        if (!d) continue;
        const reduce = d < 0;
        const filter = reduce
          ? { _id: productId, stock: { $gte: Math.abs(d) } }
          : { _id: productId };

        productOps.push({
          updateOne: { filter, update: { $inc: { stock: d, posSold: -d } } },
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
          updateOne: {
            filter,
            update: { $inc: { stockVariant: d, posSold: -d } },
          },
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

      // 7) Update customer opening dues if listed
      if (
        updatedSale.customerType?.type === "listed" &&
        updatedSale.customerType?.customerId
      ) {
        await customerModel.findByIdAndUpdate(
          updatedSale.customerType.customerId,
          { openingDues: updatedSale.balance || 0 },
          { session },
        );
      }
    });

    session.endSession();

    // invalidate product/variant caches so stock & posSold changes are visible immediately
    await bumpNsVersion("product");
    await bumpNsVersion("variant");
    // and the sales list/invoice caches, so sales history shows this change
    await bumpNsVersion(NS);

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
        // posSold moves opposite to the stock delta (stock down => posSold up)
        const productOps = [];
        for (const [productId, d] of productMap.entries()) {
          const reduce = d < 0;

          const filter = reduce
            ? { _id: productId, stock: { $gte: Math.abs(d) } }
            : { _id: productId };

          productOps.push({
            updateOne: { filter, update: { $inc: { stock: d, posSold: -d } } },
          });
        }

        const variantOps = [];
        for (const [variantId, d] of variantMap.entries()) {
          const reduce = d < 0;

          const filter = reduce
            ? { _id: variantId, stockVariant: { $gte: Math.abs(d) } }
            : { _id: variantId };

          variantOps.push({
            updateOne: {
              filter,
              update: { $inc: { stockVariant: d, posSold: -d } },
            },
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

      // 6️ Revert customer opening dues if listed
      if (
        sale.customerType?.type === "listed" &&
        sale.customerType?.customerId
      ) {
        await customerModel.findByIdAndUpdate(
          sale.customerType.customerId,
          { openingDues: sale.previousDue || 0 },
          { session },
        );
      }

      // 7️ Restore customer advance payment if applicable
      const advanceAdjust = Number(sale.customerAdvancePaymentAdjust || 0);
      if (advanceAdjust > 0 && sale.customerType?.customerId) {
        await customerAdvancePaymentModel.findOneAndUpdate(
          { customer: sale.customerType.customerId },
          {
            $inc: {
              paidAmount: advanceAdjust,
              balance: advanceAdjust,
            },
          },
          { session, upsert: true },
        );
      }
    });

    session.endSession();

    // invalidate product/variant caches so stock & posSold changes are visible immediately
    await bumpNsVersion("product");
    await bumpNsVersion("variant");
    // and the sales list/invoice caches, so sales history shows this change
    await bumpNsVersion(NS);

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
