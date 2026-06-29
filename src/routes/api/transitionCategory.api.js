const express = require("express");
const _ = express.Router();
const transitionCategoryController = require("../../controller/transionCategory.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-transaction-category").post(authGuard, authorize("transaction-category", "add"), transitionCategoryController.addTransactionCategories);
_.route("/all-transition-category").get(authGuard, authorize("transaction-category", "view"), transitionCategoryController.getAllTransitionCategory);
_.route("/single-transition-category/:slug").get(authGuard, authorize("transaction-category", "view"), transitionCategoryController.getSingleTransitionCategory);
_.route("/update-transition-category/:slug").put(authGuard, authorize("transaction-category", "edit"), transitionCategoryController.updateTransactionCategory);
_.route("/delete-transition-category/:slug").delete(authGuard, authorize("transaction-category", "delete"), transitionCategoryController.deleteTransactionCategory);

module.exports = _;
