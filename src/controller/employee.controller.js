const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateEmployeeCreate } = require("../validation/employee.validation");
const employeeModel = require("../models/employee.model");
const { cloudinaryFileUpload } = require("../helpers/cloudinary");

//  CREATE EMPLOYEE
exports.createEmployee = asynchandeler(async (req, res) => {
  const value = await validateEmployeeCreate(req);

  const newEmployee = new employeeModel({ ...value, image: "" });
  await newEmployee.save();
  apiResponse.sendSuccess(
    res,
    201,
    "Employee created successfully",
    newEmployee,
  );

  // Background Async Task
  (async () => {
    try {
      // Upload Image in background
      const { optimizeUrl } = await cloudinaryFileUpload(value.image.path);
      console.log(optimizeUrl);

      // now push the image url into the database
      await employeeModel.findByIdAndUpdate(newEmployee._id, {
        image: optimizeUrl,
      });

      console.log(" Employee Created (BG Task):", newEmployee.fullName);
    } catch (error) {
      console.error("Background Employee Creation Failed:", error.message);
    }
  })();
});

// get all employee or single employee by id
exports.getEmployeeList = asynchandeler(async (req, res) => {
  if (req.query.id) {
    const employee = await employeeModel.findOne({ employeeId: req.query.id });
    if (!employee) {
      apiResponse.sendError(res, 404, "Employee not found");
    }
    apiResponse.sendSuccess(res, 200, "Employee fetch successfully", employee);
  }
  const employeeList = await employeeModel.find().sort({ createdAt: -1 });
  apiResponse.sendSuccess(res, 200, "Employee list fetch successfully", {
    count: employeeList.length,
    employees: employeeList,
  });
});
