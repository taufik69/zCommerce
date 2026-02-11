const express = require("express");
const _ = express.Router();
const salesController = require("../../controller/sales.controller");
const { createSalesSchema } = require("../../validation/sales.validation");
const validate = require("../../middleware/validate");

_.route("/create-sales").post(
  validate(createSalesSchema),
  salesController.createSales,
);

module.exports = _;
