const express = require("express");
const _ = express.Router();
const courierController = require("../../controller/courier.controller");

_.route("/pathao-create-order").post(courierController.createPathaoOrder);

module.exports = _;
