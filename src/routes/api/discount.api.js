const express = require("express");
const _ = express.Router();
const discountController = require("../../controller/discount.controller");

_.route("/discount")
  .post(discountController.createDiscount)
  .get(discountController.getAllDiscounts);

_.route("/discount/:slug")
  .get(discountController.getDiscountBySlug)
  .put(discountController.updateDiscount);

_.route("/discount/deactive").post(discountController.deactivateDiscount);
_.route("/discount/active").post(discountController.activateDiscount);

module.exports = _;
