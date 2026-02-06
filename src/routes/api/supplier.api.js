const express = require("express");
const validate = require("../../middleware/validate");
const {
  createSupplierSchema,
  updateSupplierSchema,
  createSupplierDuePaymentSchema,
} = require("../../validation/supplier.validation");
const _ = express.Router();
const supplierController = require("../../controller/supplier.controller");

_.route("/addsupplier").post(
  validate(createSupplierSchema),
  supplierController.createSupplier,
);

_.route("/getsuppliers").get(supplierController.getAllSupplier);
_.route("/update-supplier/:supplierId").put(
  validate(updateSupplierSchema),
  supplierController.updateSupplier,
);

_.route("/delete-supplier/:supplierId").delete(
  supplierController.deleteSupplier,
);

_.route("/soft-delete-supplier/:supplierId").get(
  supplierController.softDeleteSupplier,
);

// supplier due payment api
_.route("/create-supplier-due-payment").post(
  validate(createSupplierDuePaymentSchema),
  supplierController.createSupplierDuePayment,
);

_.route("/get-supplier-due-payment").get(
  supplierController.getAllSupplierDuePayment,
);
module.exports = _;
