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
// tranaction category
_.route("/transaction-report").post(invoiceController.getTransactionReport);
_.route("/transaction-summary").post(
  invoiceController.getTransactionSummaryByDate
);
_.route("/transaction-accountwise").post(
  invoiceController.getTransactionSummaryByDateAndAccount
);
_.route("/transaction-accountnamewisesummary").post(
  invoiceController.getAcoountNamewiseTransaction
);
_.route("/getFundHandoverReport").post(invoiceController.getFundHandoverReport);
_.route("/invoicewise-report").post(invoiceController.getInvoiceReport);
_.route("/netwiseprofit-report").post(
  invoiceController.getInvoiceNetWiseProfit
);

module.exports = _;
