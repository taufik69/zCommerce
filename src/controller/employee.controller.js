const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateEmployeeCreate,
  validateEmployeeUpdate,
} = require("../validation/employee.validation");
const employeeModel = require("../models/employee.model");
const employeeAdvancePaymentModel = require("../models/advancePayment.model");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { employeeAdvancePaymentDTO } = require("../dtos/all.dto");

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

// UPDATE EMPLOYEE
exports.updateEmployee = asynchandeler(async (req, res) => {
  // 1) Validate request
  const value = await validateEmployeeUpdate(req);

  // 2) Prevent forbidden updates
  delete value.employeeId;
  delete value.createdAt;
  delete value.updatedAt;

  // 3) Fetch current employee first (need previous image)
  const employee = await employeeModel.findOne({
    employeeId: req.params.id,
  });

  if (!employee) {
    return apiResponse.sendError(res, 404, "Employee not found");
  }

  // keep old image url for later delete
  const oldImageUrl = employee.image;

  // 4) Update non-image fields immediately
  // (Don't include value.image here because it's file object)
  const { image, ...rest } = value;

  const updatedEmployee = await employeeModel.findByIdAndUpdate(
    employee._id,
    { $set: rest },
    { new: true, runValidators: true },
  );

  apiResponse.sendSuccess(
    res,
    200,
    "Employee updated successfully",
    updatedEmployee,
  );

  // 5) Background image flow (safe order)
  if (image) {
    (async () => {
      try {
        //  Upload new image first
        const { optimizeUrl } = await cloudinaryFileUpload(image.path);

        // Update DB with new image URL
        await employeeModel.findByIdAndUpdate(employee._id, {
          image: optimizeUrl,
        });

        // Delete old image only AFTER DB updated
        const parts = oldImageUrl.split("/");
        const publicId = parts[parts.length - 1].split("?")[0];

        // If no old image, skip delete
        if (publicId) {
          await deleteCloudinaryFile(publicId);
        }

        console.log("Employee image updated (BG):", employee.fullName);
      } catch (error) {
        console.error("Image update failed (BG):", error.message);
      }
    })();
  }
});

// hard delete employee

exports.deleteEmployeeHard = asynchandeler(async (req, res) => {
  const employee = await employeeModel.findOne({ employeeId: req.params.id });

  if (!employee) {
    return apiResponse.sendError(res, 404, "Employee not found");
  }

  if (employee.image) {
    try {
      // Delete old image only AFTER DB updated
      const parts = employee.image.split("/");
      const publicId = parts[parts.length - 1].split("?")[0];

      // If no old image, skip delete
      if (publicId) {
        await deleteCloudinaryFile(publicId);
      }
    } catch (error) {
      console.error("Cloudinary delete failed:", error.message);
    }
  }

  await employeeModel.deleteOne({ _id: employee._id });

  apiResponse.sendSuccess(res, 200, "Employee deleted successfully", {
    employeeId: employee.employeeId,
  });
});

// soft delete employee
exports.deleteEmployeeSoft = asynchandeler(async (req, res) => {
  const employee = await employeeModel.findOne({ employeeId: req.params.id });

  if (!employee) {
    return apiResponse.sendError(res, 404, "Employee not found");
  }

  employee.deletedAt = new Date();
  employee.isDeleted = true;
  employee.isActive = false;
  await employee.save();

  apiResponse.sendSuccess(res, 200, "Employee soft deleted successfully", {
    employeeId: employee.employeeId,
  });
});

//restor employee
exports.restoreEmployee = asynchandeler(async (req, res) => {
  const employee = await employeeModel.findOne({
    employeeId: req.params.id,
  });

  if (!employee) {
    return apiResponse.sendError(res, 404, "Employee not found");
  }

  if (!employee.isDeleted) {
    return apiResponse.sendSuccess(res, 200, "Employee is already active", {
      employeeId: employee.employeeId,
    });
  }

  employee.deletedAt = null;
  employee.isDeleted = false;
  employee.isActive = true;

  await employee.save();

  apiResponse.sendSuccess(res, 200, "Employee restored successfully", {
    employeeId: employee.employeeId,
  });
});

// create employee AdvancePayment
exports.createEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePaymentModel.create(req.body);
  if (!advancePayment) {
    return apiResponse.sendError(res, 404, "Advance Payment not found");
  }
  apiResponse.sendSuccess(
    res,
    201,
    "Advance Payment created successfully",
    employeeAdvancePaymentDTO(advancePayment),
  );
});

// get all employe advance pyament or get single advance payment by employee id
exports.getEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const { employeeId } = req.query;
  let filterQuery = {};
  if (employeeId) {
    filterQuery.employeeId = employeeId;
  } else {
    filterQuery = {};
  }

  const employeeAdvancePayment =
    await employeeAdvancePaymentModel.find(filterQuery);
  if (employeeAdvancePayment.length == 0) {
    return apiResponse.sendError(res, 404, "Advance Payment not found");
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Advance Payment fetch successfully",
    employeeAdvancePayment.map((advancePayment) =>
      employeeAdvancePaymentDTO(advancePayment),
    ),
  );
});

// update advance payemnt
exports.updateEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePaymentModel.findOneAndUpdate(
    { employeeId: req.params.id },
    req.body,
    { new: true },
  );
  if (!advancePayment) {
    return apiResponse.sendError(res, 404, "Advance Payment not found");
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Advance Payment updated successfully",
    employeeAdvancePaymentDTO(advancePayment),
  );
});

// delete advance payment
exports.deleteEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePaymentModel.findOneAndDelete({
    employeeId: req.params.id,
  });
  if (!advancePayment) {
    return apiResponse.sendError(res, 404, "Advance Payment not found");
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Advance Payment deleted successfully",
    employeeAdvancePaymentDTO(advancePayment),
  );
});
