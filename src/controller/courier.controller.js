const Merchant = require("../models/marchant.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const PathaoCourier = require("../service/couriers/PathaoCourier");

// Create single order
exports.createPathaoOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);

  const courier = new PathaoCourier(merchant);
  const order = await courier.createOrder(orderId);

  apiResponse.sendSuccess(res, 201, "Pathao order created", order);
});

// // Create bulk order
// exports.bulkPathaoOrder = asynchandeler(async (req, res) => {
//   const { merchantId, orderIds } = req.body;

//   const merchant = await Merchant.findById(merchantId);
//   if (!merchant) throw new customError("Merchant not found", 404);

//   const courier = new PathaoCourier(merchant);
//   const orders = await courier.bulkOrder(orderIds);

//   apiResponse.sendSuccess(res, 201, "Pathao bulk orders created", orders);
// });
