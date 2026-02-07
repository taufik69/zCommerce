const express = require("express");
const _ = express.Router();

const customerController = require("../../controller/customer.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");

const {
  validateCustomerCreate,
  validateCustomerUpdate,
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

module.exports = _;
