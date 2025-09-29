const express = require("express");
const _ = express.Router();
const courierController = require("../../controller/courier.controller");

// Pathao Routes
_.route("/pathao-create-order").post(courierController.createPathaoOrder);
_.route("/pathao-bulk-create-orders").post(courierController.bulkPathaoOrder);
_.route("/order-shortinfo/:id").get(courierController.getPathaoOrderShortInfo);
_.route("/pathao-webhook").post(courierController.handlePathaoWebhook);
_.route("/cities").get(courierController.getPathaoCities);
_.route("/zone/:cityId").get(courierController.getPathaoZonesByCity);
_.route("/areas/:zoneId").get(courierController.getPathaoAreasByZone);

// steadfast Routes
_.route("/steadfast-create-order").post(courierController.createSteadFastOrder);
_.route("/steadfast-bulk-create-orders").post(
  courierController.bulkSteadFastOrder
);
_.route("/steadfast-webhook").post(courierController.handleSteadFastWebhook);
// _.route("/get-steadfast-order/:id").get(courierController.getSteadFastOrderById);
// _.route("/cancel-steadfast-order/:id").post(courierController.cancelSteadFastOrderById);

module.exports = _;
