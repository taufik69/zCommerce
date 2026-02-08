const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const SSLCommerzPayment = require("sslcommerz-lts");
const Order = require("../models/order.model");
const { statusCodes } = require("../constant/constant");
// @desc success payment
exports.successPayment = asynchandeler(async (req, res) => {
  apiResponse.sendSuccess(res, statusCodes.OK, "Payment successful", req.body);
});

// @desc fail payment
exports.failPayment = asynchandeler(async (req, res) => {
  const { tran_id } = req.body;
  if (!tran_id) {
    throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  }

  // Update order payment status
  const updatedOrder = await Order.findOneAndUpdate(
    { invoiceId: tran_id },
    {
      paymentStatus: "failed",
      orderStatus: "failed",
      paymentGatewayData: req.body,
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new customError(
      "Order not found for this transaction",
      statusCodes.NOT_FOUND,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    updatedOrder,
    "Payment failed. Order status updated.",
  );
});

// @desc cancel payment
exports.cancelPayment = asynchandeler(async (req, res) => {
  const { tran_id } = req.body;
  if (!tran_id) {
    throw new customError("Transaction ID missing", statusCodes.BAD_REQUEST);
  }

  // Update order payment status
  const updatedOrder = await Order.findOneAndUpdate(
    { invoiceId: tran_id },
    {
      paymentStatus: "cancelled",
      orderStatus: "cancelled",
      paymentGatewayData: req.body,
    },
    { new: true },
  );

  if (!updatedOrder) {
    throw new customError(
      "Order not found for this transaction",
      statusCodes.NOT_FOUND,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    updatedOrder,
    "Payment cancelled. Order status updated.",
  );
});

// @desc ipn payment
exports.ipnPayment = asynchandeler(async (req, res) => {
  const { val_id } = req.body;
  if (!val_id) {
    throw new customError("Validation ID missing", statusCodes.BAD_REQUEST);
  }

  // Init SSLCommerz
  const sslcz = new SSLCommerzPayment(
    process.env.SSLC_STORE_ID,
    process.env.SSLC_STORE_PASSWORD,
    process.env.NODE_ENV === "production" ? true : false,
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
      { new: true },
    );

    if (!updatedOrder) {
      throw new customError(
        "Order not found for this transaction",
        statusCodes.NOT_FOUND,
      );
    }

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      updatedOrder,
      "Payment validated and order confirmed",
    );
  } else {
    throw new customError("Payment validation failed", statusCodes.BAD_REQUEST);
  }
});
