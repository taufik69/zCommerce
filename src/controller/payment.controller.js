const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const SSLCommerzPayment = require("sslcommerz-lts");
const Order = require("../models/order.model");
// @desc success payment
exports.successPayment = asynchandeler(async (req, res) => {
  apiResponse.sendSuccess(res, 200, "Payment successful", req.body);
});

// @desc fail payment
exports.failPayment = asynchandeler(async (req, res) => {
  try {
    console.log("Fail Payment IPN:", req.body);

    const { tran_id } = req.body;
    if (!tran_id) {
      return apiResponse.sendError(res, 400, "Transaction ID missing");
    }

    // Update order payment status
    const updatedOrder = await Order.findOneAndUpdate(
      { invoiceId: tran_id },
      {
        paymentStatus: "failed",
        orderStatus: "failed",
        paymentGatewayData: req.body,
      },
      { new: true }
    );

    if (!updatedOrder) {
      return apiResponse.sendError(
        res,
        404,
        "Order not found for this transaction"
      );
    }

    return apiResponse.sendSuccess(
      res,
      updatedOrder,
      "Payment failed. Order status updated."
    );
  } catch (error) {
    console.error("Fail Payment Error:", error);
    return apiResponse.sendError(res, 500, "Internal server error", error);
  }
});

// @desc cancel payment
exports.cancelPayment = asynchandeler(async (req, res) => {
  try {
    console.log("Cancel Payment IPN:", req.body);

    const { tran_id } = req.body;
    if (!tran_id) {
      return apiResponse.sendError(res, 400, "Transaction ID missing");
    }

    // Update order payment status
    const updatedOrder = await Order.findOneAndUpdate(
      { invoiceId: tran_id },
      {
        paymentStatus: "cancelled",
        orderStatus: "cancelled",
        paymentGatewayData: req.body,
      },
      { new: true }
    );

    if (!updatedOrder) {
      return apiResponse.sendError(
        res,
        404,
        "Order not found for this transaction"
      );
    }

    return apiResponse.sendSuccess(
      res,
      updatedOrder,
      "Payment cancelled. Order status updated."
    );
  } catch (error) {
    console.error("Cancel Payment Error:", error);
    return apiResponse.sendError(res, 500, "Internal server error", error);
  }
});

// @desc ipn payment
exports.ipnPayment = asynchandeler(async (req, res) => {
  try {
    console.log("IPN Request:", req.body);

    const { val_id } = req.body;
    if (!val_id) {
      return apiResponse.sendError(res, 400, "Validation ID missing in IPN");
    }

    // Init SSLCommerz
    const sslcz = new SSLCommerzPayment(
      process.env.SSLC_STORE_ID,
      process.env.SSLC_STORE_PASSWORD,
      process.env.NODE_ENV === "production" ? true : false
    );

    // Validate payment
    const validationResponse = await sslcz.validate({ val_id });
    console.log("Validation Response:", validationResponse);

    if (
      validationResponse?.status === "VALID" ||
      validationResponse?.status === "VALIDATED"
    ) {
      // Update order in DB
      const updatedOrder = await Order.findOneAndUpdate(
        { invoiceId: validationResponse.tran_id },
        {
          paymentStatus: "success",
          transactionId: validationResponse.tran_id,
          valId: validationResponse.val_id,
          paymentGatewayData: validationResponse,
          orderStatus: "confirmed",
        },
        { new: true }
      );

      if (!updatedOrder) {
        return apiResponse.sendError(
          res,
          404,
          "Order not found for this transaction"
        );
      }

      return apiResponse.sendSuccess(
        res,
        updatedOrder,
        "Payment validated and order confirmed"
      );
    } else {
      return apiResponse.sendError(
        res,
        400,
        "IPN payment validation failed",
        validationResponse
      );
    }
  } catch (error) {
    console.error("IPN Error:", error);
    return apiResponse.sendError(res, 500, "Internal server error", error);
  }
});
