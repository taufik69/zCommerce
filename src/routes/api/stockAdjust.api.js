const express = require("express");
const _ = express.Router();
const stockAdjustController = require("../../controller/stockAdjust.controller");

_.route("/stock-adjust")
  .post(stockAdjustController.createStockAdjust)
  .get(stockAdjustController.getAllStockAdjusts);

module.exports = _;
