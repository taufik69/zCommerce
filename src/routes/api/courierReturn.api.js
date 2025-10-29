const express = require("express");
const _ = express.Router();
const courierReturnController = require("../../controller/curierReturn.controller");

_.route("/create-courier-return").post(
  courierReturnController.createCourierReturn
);

_.route("/get-all-courier-returns").get(
  courierReturnController.getAllCourierReturns
);

module.exports = _;
