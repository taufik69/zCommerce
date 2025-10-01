const express = require("express");
const _ = express.Router();
const orderController = require("../../controller/order.controller");

_.route("/createorder").post(orderController.createOrder);
_.route("/allorders").get(orderController.getAllOrders);
_.route("/single-order/:id").get(orderController.getSingleOrder);
_.route("/order-update/:id").put(orderController.updateOrder);
_.route("/order-delete/:id").delete(orderController.deleteOrder);
_.route("/filterorderbydate").get(orderController.filterOrderdatewise);
_.route("/track-order/:invoiceid").get(orderController.trackOrder);
_.route("/delete-Order/:id").delete(orderController.deleteOrder);
_.route("/getallcourierpendingorder").get(orderController.getAllPendingOrders);

module.exports = _;
