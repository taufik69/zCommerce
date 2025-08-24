const express = require("express");
const _ = express.Router();
const stockAdjustController = require("../../controller/stockAdjust.controller");

_.route("/stock-adjust")
  .post(stockAdjustController.createStockAdjust)
  .get(stockAdjustController.getAllStockAdjusts);

_.route("/stock-adjust/category/:category").get(
  stockAdjustController.getAllProductCategoryWise
);

_.route("/stock-adjust/subcategory/:subcategory").get(
  stockAdjustController.getAllProductSSubcategoryWise
);

module.exports = _;
