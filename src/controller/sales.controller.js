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
