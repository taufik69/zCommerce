const express = require("express");
const _ = express.Router();
const invoiceController = require("../../controller/invoice.controller");
_.route("/purchase-invoice").post(invoiceController.purchaseInvoice);
_.route("/purchase-summary").post(invoiceController.purchaseSummary);

module.exports = _;
