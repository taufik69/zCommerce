const express = require("express");
const _ = express.Router();
const invoiceController = require("../../controller/invoice.controller");
_.route("/purchase-invoice").post(invoiceController.purchaseInvoice);
_.route("/purchase-summary").post(invoiceController.purchaseSummary);
_.route("/buyreturn-invoice").post(invoiceController.getPurchaseBySupplier);
_.route("/order-invoice").post(invoiceController.getInvoiceReport);
_.route("/order-status").post(invoiceController.getOrderSummaryByDate);
_.route("/courier-sendinfo").post(invoiceController.getCourierSendInformation);
_.route("/overallStock").post(invoiceController.overallStock);

module.exports = _;
