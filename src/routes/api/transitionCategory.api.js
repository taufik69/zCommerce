const express = require("express");
const _ = express.Router();
const transitionCategoryController = require("../../controller/transionCategory.controller");

_.route("/create-transaction-category").post(
  transitionCategoryController.addTransactionCategories
);
_.route("/all-transition-category").get(
  transitionCategoryController.getAllTransitionCategory
);
_.route("/single-transition-category/:slug").get(
  transitionCategoryController.getSingleTransitionCategory
);
_.route("/update-transition-category/:slug").put(
  transitionCategoryController.updateTransactionCategory
);
_.route("/delete-transition-category/:slug").delete(
  transitionCategoryController.deleteTransactionCategory
);

module.exports = _;
