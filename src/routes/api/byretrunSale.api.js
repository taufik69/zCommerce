const express = require("express");
const _ = express.Router();
const byreturnSaleController = require("../../controller/byReturnSale.controller");
_.route("/create-buyreturnsale").post(byreturnSaleController.createByReturn);
_.route("/all-buyreturnsale").get(byreturnSaleController.getAllByReturns);
_.route("/single-buyreturn/:slug").get(
  byreturnSaleController.getSingleByReturn
);
_.route("/update-buyreturn/:slug").put(byreturnSaleController.updateByReturn);
_.route("/delete-buyreturn/:slug").delete(
  byreturnSaleController.deleteByReturn
);

module.exports = _;
