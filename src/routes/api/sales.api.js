const express = require("express");
const _ = express.Router();
const salesController = require("../../controller/sales.controller");
const { createSalesSchema } = require("../../validation/sales.validation");
const validate = require("../../middleware/validate");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-sales").post(authGuard, authorize("retail-sales", "add"), validate(createSalesSchema), salesController.createSales);
_.route("/get-sales").get(authGuard, authorize("retail-sales", "view"), salesController.getAllSales);
_.route("/get-sales-products").get(authGuard, authorize("retail-sales", "view"), salesController.searchProductsAndVariants);
_.route("/update-sales/:saleId").put(authGuard, authorize("retail-sales", "edit"), salesController.updateSales);
_.route("/delete-sales/:saleId").delete(authGuard, authorize("retail-sales", "delete"), salesController.deleteSales);

module.exports = _;
