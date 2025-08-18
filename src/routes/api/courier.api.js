const express = require("express");
const _ = express.Router();
const courierController = require("../../controller/courier.controller");

_.route("/pathao-create-order").post(courierController.createOrder);

module.exports = _;
