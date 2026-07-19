const express = require("express");
const _ = express.Router();
const reportController = require("../../controller/report.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/purchase-invoice").post(
  authGuard,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceReport,
);
_.route("/purchase-invoice/suppliers").get(
  authGuard,
  authorize("purchase-invoice", "view"),
  reportController.getPurchaseInvoiceSuppliers,
);

module.exports = _;
