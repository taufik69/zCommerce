const express = require("express");
const _ = express.Router();
const orderController = require("../../controller/order.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/createorder").post(authGuard, authorize("order", "add"), orderController.createOrder);
_.route("/allorders").get(authGuard, authorize("order", "view"), orderController.getAllOrders);
_.route("/single-order/:id").get(authGuard, authorize("order", "view"), orderController.getSingleOrder);
_.route("/order-update/:id").put(authGuard, authorize("order", "edit"), orderController.updateOrder);
_.route("/order-delete/:id").delete(authGuard, authorize("order", "delete"), orderController.deleteOrder);
_.route("/filterorderbydate").get(authGuard, authorize("order", "view"), orderController.filterOrderdatewise);
_.route("/track-order/:invoiceid").get(authGuard, authorize("order", "view"), orderController.trackOrder);
_.route("/delete-Order/:id").delete(authGuard, authorize("order", "delete"), orderController.deleteOrder);
_.route("/getallcourierpendingorder").get(authGuard, authorize("order", "view"), orderController.getAllPendingOrders);
_.route("/getorderbyid").get(authGuard, authorize("order", "view"), orderController.searchOrder);
_.route("/getorderstatus").get(authGuard, authorize("order", "view"), orderController.getOrderStatusCount);
_.route("/getordercountandamount").get(authGuard, authorize("order", "view"), orderController.getOrderCountAndAmount);
_.route("/datewiseordersummary").get(authGuard, authorize("order", "view"), orderController.getTodayOrderCountAndAmount);
_.route("/getcourierinfo").get(authGuard, authorize("order", "view"), orderController.getCourierInfo);
_.route("/couriersendedorders").get(authGuard, authorize("order", "view"), orderController.getDeliveryBoyOrders);

module.exports = _;
