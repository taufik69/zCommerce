const express = require("express");
const validate = require("../../middleware/validate");
const {
  createSupplierSchema,
  updateSupplierSchema,
  createSupplierDuePaymentSchema,
  updateSupplierDuePaymentSchema,
} = require("../../validation/supplier.validation");
const _ = express.Router();
const supplierController = require("../../controller/supplier.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/addsupplier").post(
  authGuard,
  authorize("supplier", "add"),
  validate(createSupplierSchema),
  supplierController.createSupplier,
);

_.route("/getsuppliers").get(
  authGuard,
  authorize("supplier", "view"),
  supplierController.getAllSupplier,
);
_.route("/update-supplier/:supplierId").put(
  authGuard,
  authorize("supplier", "edit"),
  validate(updateSupplierSchema),
  supplierController.updateSupplier,
);

_.route("/delete-supplier/:supplierId").delete(
  authGuard,
  authorize("supplier", "delete"),
  supplierController.deleteSupplier,
);

_.route("/soft-delete-supplier/:supplierId").get(
  authGuard,
  authorize("supplier", "delete"),
  supplierController.softDeleteSupplier,
);

// supplier due payment api
_.route("/create-supplier-due-payment").post(
  authGuard,
  authorize("supplier-payment", "add"),
  validate(createSupplierDuePaymentSchema),
  supplierController.createSupplierDuePayment,
);

_.route("/get-supplier-due-payment").get(
  authGuard,
  authorize("supplier-payment", "view"),
  supplierController.getAllSupplierDuePayment,
);

_.route("/get-supplier-due-payment/:id").get(
  authGuard,
  authorize("supplier-payment", "view"),
  supplierController.getSupplierDuePaymentById,
);

_.route("/update-supplier-due-payment/:id").put(
  authGuard,
  authorize("supplier-payment", "edit"),
  validate(updateSupplierDuePaymentSchema),
  supplierController.updateSupplierDuePayment,
);

_.route("/soft-delete-supplier-due-payment/:supplierId").delete(
  authGuard,
  authorize("supplier-payment", "delete"),
  supplierController.softDeleteSupplierDuePayment,
);

_.route("/delete-supplier-due-payment/:supplierId").delete(
  authGuard,
  authorize("supplier-payment", "delete"),
  supplierController.deleteSupplierDuePayment,
);

_.route("/supplier-due-payment/:id/activate").put(
  authGuard,
  authorize("supplier-payment", "edit"),
  supplierController.activateSupplierDuePayment,
);

_.route("/supplier-due-payment/:id/deactivate").put(
  authGuard,
  authorize("supplier-payment", "edit"),
  supplierController.deactivateSupplierDuePayment,
);

module.exports = _;
