const express = require("express");
const _ = express.Router();
const employeeController = require("../../controller/employee.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
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
module.exports = _;
