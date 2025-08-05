const express = require("express");
const _ = express.Router();
const DeliveryChargeController = require("../../controller/deliveryCharge.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-delivery-charge").post(
  //   authGuard,
  // authorize(deliveryChargePermission, "add"),
  DeliveryChargeController.createDeliveryCharge
);

_.route("/get-delivery-charge").get(
  // authenticate,
  // authorize(deliveryChargePermission, "view"),
  DeliveryChargeController.getDeliveryCharge
);
_.route("/update-delivery-charge/:id").put(
  // authenticate,
  // authorize(deliveryChargePermission, "update"),
  DeliveryChargeController.updateDeliveryCharge
);
_.route("/delete-delivery-charge/:id").delete(
  // authenticate,
  // authorize(deliveryChargePermission, "delete"),
  DeliveryChargeController.deleteDeliveryCharge
);

_.route("/get-single-delivery-charge/:id").get(
  // authenticate,
  // authorize(deliveryChargePermission, "view"),
  DeliveryChargeController.getSingleDeliveryCharge
);

module.exports = _;
