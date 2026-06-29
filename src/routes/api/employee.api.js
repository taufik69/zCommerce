const express = require("express");
const _ = express.Router();
const employeeController = require("../../controller/employee.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { anyFileUpload } = require("../../middleware/multer.middleware");
const {
  createEmployeeAdvancePaymentSchema,
  updateEmployeeAdvancePaymentSchema,
} = require("../../validation/employeeAdvancePayment.validation");
const validate = require("../../middleware/validate");

_.route("/create-employee").post(
  authGuard,
  authorize("employee", "add"),
  anyFileUpload(),
  employeeController.createEmployee,
);
_.route("/get-employee").get(
  authGuard,
  authorize("employee", "view"),
  employeeController.getEmployeeList,
);
_.route("/update-employee/:id").put(
  authGuard,
  authorize("employee", "edit"),
  anyFileUpload(),
  employeeController.updateEmployee,
);
_.route("/delete-employee/:id").delete(
  authGuard,
  authorize("employee", "delete"),
  employeeController.deleteEmployeeHard,
);
_.route("/delete-employee-soft/:id").delete(
  authGuard,
  authorize("employee", "delete"),
  employeeController.deleteEmployeeSoft,
);
_.route("/restore-employee/:id").put(
  authGuard,
  authorize("employee", "edit"),
  employeeController.restoreEmployee,
);

// Advance Payment api
_.route("/employee-advance-payment").post(
  authGuard,
  authorize("employee", "add"),
  validate(createEmployeeAdvancePaymentSchema),
  employeeController.createEmployeeAdvancePayment,
);
_.route("/get-employee-advance-payment").get(
  authGuard,
  authorize("employee", "view"),
  employeeController.getEmployeeAdvancePayment,
);

_.route("/update-employee-advance-payment/:id").put(
  authGuard,
  authorize("employee", "edit"),
  validate(updateEmployeeAdvancePaymentSchema),
  employeeController.updateEmployeeAdvancePayment,
);

_.route("/delete-employee-advance-payment/:id").delete(
  authGuard,
  authorize("employee", "delete"),
  employeeController.deleteEmployeeAdvancePayment,
);

// designation api
_.route("/create-employee-designation").post(
  authGuard,
  authorize("designation", "add"),
  employeeController.createEmployeeDesignation,
);
_.route("/get-employee-designation").get(
  authGuard,
  authorize("designation", "view"),
  employeeController.getEmployeeDesignation,
);

_.route("/update-employee-designation/:slug").put(
  authGuard,
  authorize("designation", "edit"),
  employeeController.updateEmployeeDesignation,
);

_.route("/delete-employee-designation/:slug").delete(
  authGuard,
  authorize("designation", "delete"),
  employeeController.deleteEmployeeDesignation,
);

// department api
_.route("/create-employee-department").post(
  authGuard,
  authorize("department", "add"),
  employeeController.createEmployeeDepartment,
);
_.route("/get-employee-department").get(
  authGuard,
  authorize("department", "view"),
  employeeController.getEmployeeDepartment,
);
_.route("/update-employee-department/:slug").put(
  authGuard,
  authorize("department", "edit"),
  employeeController.updateEmployeeDepartment,
);
_.route("/delete-employee-department/:slug").delete(
  authGuard,
  authorize("department", "delete"),
  employeeController.deleteEmployeeDepartment,
);

// section api
_.route("/create-employee-section").post(
  authGuard,
  authorize("section", "add"),
  employeeController.createEmployeeSection,
);
_.route("/get-employee-section").get(
  authGuard,
  authorize("section", "view"),
  employeeController.getEmployeeSection,
);
_.route("/update-employee-section/:slug").put(
  authGuard,
  authorize("section", "edit"),
  employeeController.updateEmployeeSection,
);
_.route("/delete-employee-section/:slug").delete(
  authGuard,
  authorize("section", "delete"),
  employeeController.deleteEmployeeSection,
);

module.exports = _;
