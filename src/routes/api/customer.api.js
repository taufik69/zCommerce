const express = require("express");
const _ = express.Router();

const customerController = require("../../controller/customer.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const validate = require("../../middleware/validate");
const {
  validateCustomerCreate,
  validateCustomerUpdate,
  createCustomerPaymentSchema,
  createCustomerAdvancePaymentSchema,
  updateCustomerAdvancePaymentSchema,
} = require("../../validation/customer.validation");

_.route("/create-customer").post(
  multipleFileUpload("image", 1),
  validateCustomerCreate,
  customerController.createCustomer,
);

_.route("/get-customers").get(customerController.getAllCustomers);

_.route("/update-customer/:customerId").put(
  multipleFileUpload("image", 1),
  validateCustomerUpdate,
  customerController.updateCustomer,
);

_.route("/delete-customer/:customerId").delete(
  customerController.deleteCustomer,
);
// customer payment recived api
_.route("/customer-payment-recived").post(
  validate(createCustomerPaymentSchema),
  customerController.createCustomerPaymentRecived,
);

_.route("/get-customer-payment-recived").get(
  customerController.getCustomerPaymentReviced,
);

_.route("/update-customer-payment-recived/:slug").put(
  customerController.updateCustomerPaymentRecived,
);
_.route("/delete-customer-payment-recived/:slug").delete(
  customerController.deleteCustomerPaymentRecived,
);

// customer advance payment recived api
_.route("/customer-advance-payment-recived").post(
  validate(createCustomerAdvancePaymentSchema),
  customerController.createCustomerAdvancePaymentRecived,
);

_.route("/get-customer-advance-payment-reviced").get(
  customerController.getCustomerAdvancePaymentReviced,
);

_.route("/update-customer-advance-payment-recived/:slug").put(
  validate(updateCustomerAdvancePaymentSchema),
  customerController.updateCustomerAdvancePaymentRecived,
);
_.route("/delete-customer-advance-payment-recived/:slug").delete(
  customerController.deleteCustomerAdvancePaymentRecived,
);
module.exports = _;
