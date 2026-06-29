const express = require("express");
const _ = express.Router();
const courierReturnController = require("../../controller/curierReturn.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-courier-return").post(
  authGuard,
  authorize("courier-return", "add"),
  courierReturnController.createCourierReturn,
);

_.route("/get-all-courier-returns").get(
  authGuard,
  authorize("courier-return", "view"),
  courierReturnController.getAllCourierReturns,
);

module.exports = _;
