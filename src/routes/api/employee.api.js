const express = require("express");
const _ = express.Router();
const employeeController = require("../../controller/employee.controller");

const { multipleFileUpload } = require("../../middleware/multer.middleware");
const {
  createEmployeeAdvancePaymentSchema,
  updateEmployeeAdvancePaymentSchema,
} = require("../../validation/employeeAdvancePayment.validation");
const validate = require("../../middleware/validate");
_.route("/create-employee").post(
  multipleFileUpload("image", 1),
  employeeController.createEmployee,
);
_.route("/get-employee").get(employeeController.getEmployeeList);
_.route("/update-employee/:id").put(
  multipleFileUpload("image", 1),
  employeeController.updateEmployee,
);
_.route("/delete-employee/:id").delete(employeeController.deleteEmployeeHard);
_.route("/delete-employee-soft/:id").delete(
  employeeController.deleteEmployeeSoft,
);
_.route("/restore-employee/:id").put(employeeController.restoreEmployee);

// Advance Payment api
_.route("/employee-advance-payment").post(
  validate(createEmployeeAdvancePaymentSchema),
  employeeController.createEmployeeAdvancePayment,
);
_.route("/get-employee-advance-payment").get(
  employeeController.getEmployeeAdvancePayment,
);

_.route("/update-employee-advance-payment/:id").put(
  validate(updateEmployeeAdvancePaymentSchema),
  employeeController.updateEmployeeAdvancePayment,
);

_.route("/delete-employee-advance-payment/:id").delete(
  employeeController.deleteEmployeeAdvancePayment,
);

// designation api
_.route("/create-employee-designation").post(
  employeeController.createEmployeeDesignation,
);
_.route("/get-employee-designation").get(
  employeeController.getEmployeeDesignation,
);

_.route("/update-employee-designation/:slug").put(
  employeeController.updateEmployeeDesignation,
);

_.route("/delete-employee-designation/:slug").delete(
  employeeController.deleteEmployeeDesignation,
);

// department api
_.route("/create-employee-department").post(
  employeeController.createEmployeeDepartment,
);
_.route("/get-employee-department").get(
  employeeController.getEmployeeDepartment,
);
_.route("/update-employee-department/:slug").put(
  employeeController.updateEmployeeDepartment,
);
_.route("/delete-employee-department/:slug").delete(
  employeeController.deleteEmployeeDepartment,
);

// section api
_.route("/create-employee-section").post(
  employeeController.createEmployeeSection,
);
_.route("/get-employee-section").get(employeeController.getEmployeeSection);
_.route("/update-employee-section/:slug").put(
  employeeController.updateEmployeeSection,
);
_.route("/delete-employee-section/:slug").delete(
  employeeController.deleteEmployeeSection,
);
module.exports = _;
