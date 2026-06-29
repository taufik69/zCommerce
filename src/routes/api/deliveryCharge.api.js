const express = require("express");
const _ = express.Router();
const DeliveryChargeController = require("../../controller/deliveryCharge.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-delivery-charge").post(authGuard, authorize("delivery-charge", "add"), DeliveryChargeController.createDeliveryCharge);
_.route("/get-delivery-charge").get(authGuard, authorize("delivery-charge", "view"), DeliveryChargeController.getDeliveryCharge);
_.route("/update-delivery-charge/:id").put(authGuard, authorize("delivery-charge", "edit"), DeliveryChargeController.updateDeliveryCharge);
_.route("/delete-delivery-charge/:id").delete(authGuard, authorize("delivery-charge", "delete"), DeliveryChargeController.deleteDeliveryCharge);
_.route("/get-single-delivery-charge/:id").get(authGuard, authorize("delivery-charge", "view"), DeliveryChargeController.getSingleDeliveryCharge);

module.exports = _;
