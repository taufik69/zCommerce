const express = require("express");
const _ = express.Router();
const courierController = require("../../controller/courier.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

// Pathao Routes
_.route("/pathao-create-order").post(
  authGuard,
  authorize("courier-delivery", "add"),
  courierController.createPathaoOrder,
);
_.route("/pathao-bulk-create-orders").post(
  authGuard,
  authorize("courier-delivery", "add"),
  courierController.bulkPathaoOrder,
);
_.route("/order-shortinfo/:id").get(
  authGuard,
  authorize("courier-delivery", "view"),
  courierController.getPathaoOrderShortInfo,
);
_.route("/pathao-webhook").post(courierController.handlePathaoWebhook);
_.route("/cities").get(
  authGuard,
  authorize("courier-delivery", "view"),
  courierController.getPathaoCities,
);
_.route("/zone/:cityId").get(
  authGuard,
  authorize("courier-delivery", "view"),
  courierController.getPathaoZonesByCity,
);
_.route("/areas/:zoneId").get(
  authGuard,
  authorize("courier-delivery", "view"),
  courierController.getPathaoAreasByZone,
);

// steadfast Routes
_.route("/steadfast-create-order").post(
  authGuard,
  authorize("courier-delivery", "add"),
  courierController.createSteadFastOrder,
);
_.route("/steadfast-bulk-create-orders").post(
  authGuard,
  authorize("courier-delivery", "add"),
  courierController.bulkSteadFastOrder,
);
_.route("/steadfast-webhook").post(courierController.handleSteadFastWebhook);

module.exports = _;
