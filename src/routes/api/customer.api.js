const express = require("express");
const _ = express.Router();

const customerController = require("../../controller/customer.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const validate = require("../../middleware/validate");
const {
  validateCustomerCreate,
  validateCustomerUpdate,
  createCustomerPaymentSchema,
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

module.exports = _;
