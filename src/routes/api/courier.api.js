const express = require("express");
const _ = express.Router();
const courierController = require("../../controller/courier.controller");

_.route("/pathao-create-order").post(courierController.createPathaoOrder);
_.route("/cities").get(courierController.getPathaoCities);
_.route("/zone/:cityId").get(courierController.getPathaoZonesByCity);
_.route("/areas/:zoneId").get(courierController.getPathaoAreasByZone);

module.exports = _;
