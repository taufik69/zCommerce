const express = require("express");
const _ = express.Router();
const invoiceController = require("../../controller/invoice.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/purchase-invoice").post(authGuard, authorize("purchase-invoice", "view"), invoiceController.purchaseInvoice);
_.route("/purchase-summary").post(authGuard, authorize("purchase-summary", "view"), invoiceController.purchaseSummary);
_.route("/purchase-supplier").get(authGuard, authorize("purchase-summary", "view"), invoiceController.getSupplierSummary);
_.route("/buyreturn-invoice").post(authGuard, authorize("purchase-return-report", "view"), invoiceController.getPurchaseBySupplier);
_.route("/order-invoice").post(authGuard, authorize("order-invoice", "view"), invoiceController.getInvoiceReport);
_.route("/order-status").post(authGuard, authorize("order-status-report", "view"), invoiceController.getOrderSummaryByDate);
_.route("/courier-sendinfo").post(authGuard, authorize("order-status-report", "view"), invoiceController.getCourierSendInformation);
_.route("/overallStock").post(authGuard, authorize("view-all-stock", "view"), invoiceController.overallStock);
_.route("/transaction-category").get(authGuard, authorize("transaction-category", "view"), invoiceController.getTransactionCategories);
_.route("/getallaccounts").get(authGuard, authorize("add-account", "view"), invoiceController.getAllAccounts);
_.route("/transaction-report").post(authGuard, authorize("transaction-report", "view"), invoiceController.getTransactionReport);
_.route("/transaction-summary").post(authGuard, authorize("transaction-summary", "view"), invoiceController.getTransactionSummaryByDate);
_.route("/cash-ledger-report").post(authGuard, authorize("cash-ledger", "view"), invoiceController.getCashLedgerReport);
_.route("/transaction-accountwise").post(authGuard, authorize("transaction-account-wise", "view"), invoiceController.getTransactionSummaryByDateAndAccount);
_.route("/transaction-accountnamewisesummary").post(authGuard, authorize("account-transaction-summary", "view"), invoiceController.getAcoountNamewiseTransaction);
_.route("/getFundHandoverReport").post(authGuard, authorize("fund-handover", "view"), invoiceController.getFundHandoverReport);
_.route("/invoicewise-report").post(authGuard, authorize("order-invoice", "view"), invoiceController.getInvoiceReport);
_.route("/netwiseprofit-report").post(authGuard, authorize("transaction-report", "view"), invoiceController.getInvoiceNetWiseProfit);
_.route("/followup-report").post(authGuard, authorize("order-status-report", "view"), invoiceController.getOrdersByDateAndFollowUp);
_.route("/pushwebsalesvariant").get(authGuard, authorize("view-all-stock", "view"), invoiceController.getZeroSaleVariantsLast30Days);
_.route("/pushwebsalesproduct").get(authGuard, authorize("view-all-stock", "view"), invoiceController.getZeroSaleProductsLast30Days);

module.exports = _;
