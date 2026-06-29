const express = require("express");
const _ = express.Router();
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const customerController = require("../../controller/customer.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const validate = require("../../middleware/validate");
const {
  validateCustomerCreate,
  validateCustomerUpdate,
  createCustomerPaymentSchema,
  createCustomerAdvancePaymentSchema,
} = require("../../validation/customer.validation");

// customer type api
_.route("/create-customertype").post(
  authGuard,
  authorize("customer-type", "add"),
  customerController.createCustomerType,
);
_.route("/get-customertypes").get(
  authGuard,
  authorize("customer-type", "view"),
  customerController.getAllCustomersTypes,
);
_.route("/update-customertype/:slug").put(
  authGuard,
  authorize("customer-type", "edit"),
  customerController.updateCustomerType,
);

_.route("/delete-customertype/:slug").delete(
  authGuard,
  authorize("customer-type", "delete"),
  customerController.deleteCustomerType,
);

// customer api
_.route("/create-customer").post(
  authGuard,
  authorize("customer", "add"),
  multipleFileUpload("image", 1),
  validateCustomerCreate,
  customerController.createCustomer,
);
_.route("/get-customers").get(
  authGuard,
  authorize("customer", "view"),
  customerController.getAllCustomers,
);
_.route("/update-customer/:customerId").put(
  authGuard,
  authorize("customer", "edit"),
  multipleFileUpload("image", 1),
  validateCustomerUpdate,
  customerController.updateCustomer,
);

_.route("/delete-customer/:customerId").delete(
  authGuard,
  authorize("customer", "delete"),
  customerController.deleteCustomer,
);
_.route("/activate-customer/:customerId").put(
  authGuard,
  authorize("customer", "edit"),
  customerController.activateCustomer,
);
_.route("/deactivate-customer/:customerId").put(
  authGuard,
  authorize("customer", "edit"),
  customerController.deactivateCustomer,
);

// customer payment recived api
_.route("/customer-payment-recived").post(
  authGuard,
  authorize("customer-payment", "add"),
  validate(createCustomerPaymentSchema),
  customerController.createCustomerPaymentRecived,
);

_.route("/get-customer-payment-recived").get(
  authGuard,
  authorize("customer-payment", "view"),
  customerController.getCustomerPaymentReviced,
);

_.route("/update-customer-payment-recived/:customer").put(
  authGuard,
  authorize("customer-payment", "edit"),
  customerController.updateCustomerPaymentRecived,
);
_.route("/delete-customer-payment-recived/:id").delete(
  authGuard,
  authorize("customer-payment", "delete"),
  customerController.deleteCustomerPaymentRecived,
);

// customer advance payment recived api
_.route("/customer-advance-payment-recived").post(
  authGuard,
  authorize("advance-payment", "add"),
  validate(createCustomerAdvancePaymentSchema),
  customerController.createCustomerAdvancePaymentRecived,
);

_.route("/get-customer-advance-payment-reviced").get(
  authGuard,
  authorize("advance-payment", "view"),
  customerController.getCustomerAdvancePaymentReviced,
);

_.route("/delete-customer-advance-payment-recived/:id").delete(
  authGuard,
  authorize("advance-payment", "delete"),
  customerController.deleteCustomerAdvancePaymentRecived,
);

module.exports = _;
