const express = require("express");
const _ = express.Router();
const salesController = require("../../controller/sales.controller");
const { createSalesSchema } = require("../../validation/sales.validation");
const validate = require("../../middleware/validate");

_.route("/create-sales").post(
  validate(createSalesSchema),
  salesController.createSales,
);

_.route("/get-sales").get(salesController.getAllSales);

_.route("/get-sales-products").get(salesController.searchProductsAndVariants);
_.route("/update-sales/:saleId").put(salesController.updateSales);
_.route("/delete-sales/:saleId").delete(salesController.deleteSales);

module.exports = _;
