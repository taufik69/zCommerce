const express = require("express");
const _ = express.Router();
const byreturnSaleController = require("../../controller/byReturnSale.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-buyreturnsale").post(authGuard, authorize("purchase-return", "add"), byreturnSaleController.createByReturn);
_.route("/all-buyreturnsale").get(authGuard, authorize("purchase-return", "view"), byreturnSaleController.getAllByReturns);
_.route("/single-buyreturn/:slug").get(authGuard, authorize("purchase-return", "view"), byreturnSaleController.getSingleByReturn);
_.route("/update-buyreturn/:slug").put(authGuard, authorize("purchase-return", "edit"), byreturnSaleController.updateByReturn);
_.route("/delete-buyreturn/:slug").delete(authGuard, authorize("purchase-return", "delete"), byreturnSaleController.deleteByReturn);

module.exports = _;
