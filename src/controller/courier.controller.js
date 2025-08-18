const { customError } = require("../lib/CustomError");
const Merchant = require("../models/marchant.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const PathaoCourier = require("../service/couriers/PathaoCourier");
// @desc Create a new courier order

exports.createOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;

  // Validate the merchant ID
  if (!merchantId) {
    throw new customError("Merchant ID is required", 400);
  }

  // Find the merchant
  const merchant = await Merchant.findOne({ merchantID: merchantId });
  if (!merchant) {
    throw new customError("Merchant not found", 404);
  }

  // Create a new courier order using PathaoCourier service
  const courierService = new PathaoCourier();
  const orderResponse = await courierService.createOrder(merchant, orderId);

  // Send success response
  apiResponse.sendSuccess(
    res,
    201,
    "Order created successfully",
    orderResponse
  );
});
