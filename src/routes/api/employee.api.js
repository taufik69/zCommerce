const express = require("express");
const _ = express.Router();
const employeeController = require("../../controller/employee.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
_.route("/create-employee").post(
  multipleFileUpload("image", 1),
  employeeController.createEmployee,
);
_.route("/get-employee").get(employeeController.getEmployeeList);
module.exports = _;
