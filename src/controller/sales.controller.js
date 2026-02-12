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
