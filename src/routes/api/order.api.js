const express = require("express");
const _ = express.Router();
const orderController = require("../../controller/order.controller");

_.route("/createorder").post(orderController.createOrder);
// _.route("/allorders").get(orderController.getAllOrders);
// _.route("/order/:id").get(orderController.getOrderById);
// _.route("/order-update/:id").put(orderController.updateOrder);
// _.route("/order-delete/:id").delete(orderController.deleteOrder);

module.exports = _;
