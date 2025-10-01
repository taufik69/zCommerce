const Merchant = require("../models/marchant.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const PathaoCourier = require("../service/couriers/PathaoCourier");
const cityZoneService = require("../service/couriers/courierCityZone");

// Create single order
exports.createPathaoOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);

  const courier = new PathaoCourier(merchant);
  const order = await courier.createOrder(orderId);
  if (!order) throw new customError("Failed to create Pathao order", 500);
  apiResponse.sendSuccess(res, 201, "Pathao order created", order);
});

exports.bulkPathaoOrder = asynchandeler(async (req, res) => {
  const { orderIds, merchantId } = req.body;
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new PathaoCourier(merchant);
  const orders = await courier.bulkOrderByIds(orderIds);

  if (!orders)
    throw new customError("Failed to create Pathao bulk orders", 500);
  apiResponse.sendSuccess(res, 201, "Pathao bulk orders created", orders);
});

// get short info of a Pathao order by internal order ID
exports.getPathaoOrderShortInfo = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new customError("Order ID is required", 400);
  const merchant = await Merchant.findById(req.body.merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new PathaoCourier(merchant);
  const orderInfo = await courier.getOrderInfo(id);
  if (!orderInfo) throw new customError("Order not found", 404);
  apiResponse.sendSuccess(res, 200, "Order info fetched", orderInfo);
});

// pathao webhook handler
exports.handlePathaoWebhook = asynchandeler(async (req, res) => {
  const merchant = await Merchant.findOne({ serviceProvider: "pathao" });
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new PathaoCourier(merchant);
  await courier.handlePathaoWebhook(req, res);
});

//@desc Get available cities
//@route GET /api/v1/courier/pathao/cities

exports.getPathaoCities = asynchandeler(async (req, res) => {
  const cityZone = new cityZoneService();
  const cities = await cityZone.getCities();
  apiResponse.sendSuccess(res, 200, "Cities fetched successfully", cities);
});

//@desc Get zones by city ID
//@route GET /api/v1/courier/pathao/cities/:cityId/zones
exports.getPathaoZonesByCity = asynchandeler(async (req, res) => {
  const { cityId } = req.params;
  if (!cityId) throw new customError("City ID is required", 400);

  const cityZone = new cityZoneService();
  const zones = await cityZone.getZones(cityId);
  apiResponse.sendSuccess(res, 200, "Zones fetched successfully", zones);
});

//@desc Get areas by zone ID
//@route GET /api/v1/courier/pathao/zones/:zoneId/areas
exports.getPathaoAreasByZone = asynchandeler(async (req, res) => {
  const { zoneId } = req.params;
  if (!zoneId) throw new customError("Zone ID is required", 400);
  const cityZone = new cityZoneService();
  const areas = await cityZone.getAreas(zoneId);
  apiResponse.sendSuccess(res, 200, "Areas fetched successfully", areas);
});

// Steadfast Courier Integration
const SteadFastCourier = require("../service/couriers/steadFast/SteadFastCourier");
// Create single order
exports.createSteadFastOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new SteadFastCourier(merchant);
  const order = await courier.createOrder(orderId);
  if (!order) throw new customError("Failed to create Steadfast order", 500);
  apiResponse.sendSuccess(res, 201, "Steadfast order created", order);
});

// create bulk order
exports.bulkSteadFastOrder = asynchandeler(async (req, res) => {
  const { startDate, endDate, merchantId } = req.body;
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new SteadFastCourier(merchant);
  const orders = await courier.bulkCreateOrders(startDate, endDate);

  if (!orders)
    throw new customError("Failed to create Steadfast bulk orders", 500);
  apiResponse.sendSuccess(res, 201, "Steadfast bulk orders created", orders);
});

// Steadfast webhook handler
exports.handleSteadFastWebhook = asynchandeler(async (req, res) => {
  const courier = new SteadFastCourier();
  const response = await courier.handleSteadFastWebhook(req, res);
  apiResponse.sendSuccess(res, 200, "Webhook handled", response);
});
