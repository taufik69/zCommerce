const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const mongoose = require("mongoose");
const {
  validateEmployeeCreate,
  validateEmployeeUpdate,
} = require("../validation/employee.validation");
const employeeModel = require("../models/employee.model");
const {} = require("../models/advancePayment.model");
const {
  employeeAdvancePayment,
  employeeDesignationModel,
  departmentModel,
  sectionModel,
} = require("../models/advancePayment.model");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const {
  employeeAdvancePaymentDTO,
  employeeDesignationDTO,
  employeeDepartmentDTO,
} = require("../dtos/all.dto");
const { statusCodes } = require("../constant/constant");

//  CREATE EMPLOYEE
exports.createEmployee = asynchandeler(async (req, res, next) => {
  const value = await validateEmployeeCreate(req, res, next);

  const newEmployee = new employeeModel({ ...value, image: "" });
  await newEmployee.save();
  if (!newEmployee)
    throw new customError("Employee not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
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
      apiResponse.sendError(res, statusCodes.NOT_FOUND, "Employee not found");
    }
    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee fetch successfully",
      employee,
    );
  }
  const employeeList = await employeeModel.find().sort({ createdAt: -1 });
  apiResponse.sendSuccess(res, 200, "Employee list fetch successfully", {
    count: employeeList.length,
    employees: employeeList,
  });
});

// UPDATE EMPLOYEE
exports.updateEmployee = asynchandeler(async (req, res, next) => {
  // 1) Validate request
  const value = await validateEmployeeUpdate(req, res, next);

  // 2) Prevent forbidden updates
  delete value.employeeId;
  delete value.createdAt;
  delete value.updatedAt;

  // 3) Fetch current employee first (need previous image)
  const employee = await employeeModel.findOne({
    employeeId: req.params.id,
  });

  if (!employee) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Employee not found",
    );
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
    statusCodes.OK,
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
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Employee not found",
    );
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

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee deleted successfully",
    {
      employeeId: employee.employeeId,
    },
  );
});

// soft delete employee
exports.deleteEmployeeSoft = asynchandeler(async (req, res) => {
  const employee = await employeeModel.findOne({ employeeId: req.params.id });

  if (!employee) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Employee not found",
    );
  }

  employee.deletedAt = new Date();
  employee.isDeleted = true;
  employee.isActive = false;
  await employee.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee soft deleted successfully",
    {
      employeeId: employee.employeeId,
    },
  );
});

//restor employee
exports.restoreEmployee = asynchandeler(async (req, res) => {
  const employee = await employeeModel.findOne({
    employeeId: req.params.id,
  });

  if (!employee) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Employee not found",
    );
  }

  if (!employee.isDeleted) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee is already active",
      {
        employeeId: employee.employeeId,
      },
    );
  }

  employee.deletedAt = null;
  employee.isDeleted = false;
  employee.isActive = true;

  await employee.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee restored successfully",
    {
      employeeId: employee.employeeId,
    },
  );
});

// --------------------> create employee AdvancePayment
exports.createEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const employeeId = req.body.employeeId;
    const amount = Number(req.body.amount || 0);

    if (!employeeId) {
      throw new customError("EmployeeId is required", statusCodes.BAD_REQUEST);
    }
    if (amount <= 0) {
      throw new customError(
        "Amount must be greater than 0",
        statusCodes.BAD_REQUEST,
      );
    }

    let advancePaymentDoc;

    await session.withTransaction(async () => {
      // 1) ensure employee exists
      const employee = await employeeModel
        .findOne({ employeeId: employeeId })
        .session(session);

      if (!employee) {
        throw new customError("Employee not found", statusCodes.NOT_FOUND);
      }

      // (optional) salary enough check: if you want prevent negative salary
      const grossSalary = Number(employee?.salary?.grossSalary || 0);
      if (amount > grossSalary)
        throw new customError("Salary not enough", statusCodes.BAD_REQUEST);

      // 2) create advance payment
      const doc = new employeeAdvancePayment({ ...req.body, amount });
      advancePaymentDoc = await doc.save({ session });

      // 3) reduce from salary (minus)
      const updatedEmployee = await employeeModel.findOneAndUpdate(
        { employeeId },
        { $inc: { "salary.grossSalary": -amount } },
        { new: true, runValidators: true, session },
      );

      if (!updatedEmployee) {
        throw new customError(
          "Employee update failed",
          statusCodes.SERVER_ERROR,
        );
      }
    });

    session.endSession();

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Advance Payment created successfully",
      employeeAdvancePaymentDTO(advancePaymentDoc),
    );
  } catch (err) {
    session.endSession();
    throw err;
  } finally {
    await session.endSession();
  }
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

  const employeeAdvancePaymentDoc =
    await employeeAdvancePayment.find(filterQuery);
  if (employeeAdvancePaymentDoc.length == 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Advance Payment not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Advance Payment fetch successfully",
    employeeAdvancePaymentDoc.map((employeeAdvancePayment) =>
      employeeAdvancePaymentDTO(employeeAdvancePayment),
    ),
  );
});

// update advance payemnt
exports.updateEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePayment.findOneAndUpdate(
    { employeeId: req.params.id },
    req.body,
    { new: true },
  );
  if (!advancePayment) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Advance Payment not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Advance Payment updated successfully",
    employeeAdvancePaymentDTO(advancePayment),
  );
});

// delete advance payment
exports.deleteEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePayment.findOneAndDelete({
    employeeId: req.params.id,
  });
  if (!advancePayment) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Advance Payment not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Advance Payment deleted successfully",
    employeeAdvancePaymentDTO(advancePayment),
  );
});

// ---------------------- employee designation controller -----------------------

// create employee designation
exports.createEmployeeDesignation = asynchandeler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    throw new customError(
      "Designation name is required",
      statusCodes.BAD_REQUEST,
    );
  }
  const employeeDesignation = await employeeDesignationModel.create(req.body);
  if (!employeeDesignation) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Designation not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Designation created successfully",
    employeeDesignationDTO(employeeDesignation),
  );
});

//  get all employee designation or get designnation using slug by req.query
exports.getEmployeeDesignation = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  } else {
    filterQuery = {};
  }

  const employeeDesignation = await employeeDesignationModel.find(filterQuery);
  if (employeeDesignation.length == 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Designation not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Designation fetch successfully",
    employeeDesignation.map((designation) =>
      employeeDesignationDTO(designation),
    ),
  );
});

// update designation using slug
exports.updateEmployeeDesignation = asynchandeler(async (req, res) => {
  const designation = await employeeDesignationModel.findOneAndUpdate(
    { slug: req.params.slug },
    req.body,
    { new: true },
  );
  if (!designation) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Designation not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Designation updated successfully",
    employeeDesignationDTO(designation),
  );
});

// delete designation using slug
exports.deleteEmployeeDesignation = asynchandeler(async (req, res) => {
  const designation = await employeeDesignationModel.findOneAndDelete({
    slug: req.params.slug,
  });
  if (!designation) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Designation not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Designation deleted successfully",
    employeeDesignationDTO(designation),
  );
});

// ---------------------- employee department controller -----------------------
exports.createEmployeeDepartment = asynchandeler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    throw new customError(
      statusCodes.BAD_REQUEST,
      "Department name is required",
    );
  }
  const employeeDepartment = await departmentModel.create(req.body);
  if (!employeeDepartment) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Department not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Department created successfully",
    employeeDepartmentDTO(employeeDepartment),
  );
});

// get all deapartment or get department using slug by req.query
exports.getEmployeeDepartment = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  } else {
    filterQuery = {};
  }

  const employeeDepartment = await departmentModel.find(filterQuery);
  if (employeeDepartment.length == 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Department not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Department fetch successfully",
    employeeDepartment.map((department) => employeeDepartmentDTO(department)),
  );
});
// update department using slug
exports.updateEmployeeDepartment = asynchandeler(async (req, res) => {
  const department = await departmentModel.findOneAndUpdate(
    { slug: req.params.slug },
    req.body,
    { new: true },
  );
  if (!department) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Department not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Department updated successfully",
    employeeDepartmentDTO(department),
  );
});

// delete deparment using slug
exports.deleteEmployeeDepartment = asynchandeler(async (req, res) => {
  const department = await departmentModel.findOneAndDelete({
    slug: req.params.slug,
  });
  if (!department) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Department not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Department deleted successfully",
    employeeDepartmentDTO(department),
  );
});

// ------ section controller ------
exports.createEmployeeSection = asynchandeler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    throw new customError(statusCodes.BAD_REQUEST, "Section name is required");
  }
  const employeeSection = await sectionModel.create(req.body);
  if (!employeeSection) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Section not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Section created successfully",
    employeeDepartmentDTO(employeeSection),
  );
});

// get all section list or get section using slug by req.query
exports.getEmployeeSection = asynchandeler(async (req, res) => {
  const { slug } = req.query;
  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  } else {
    filterQuery = {};
  }

  const employeeSection = await sectionModel.find(filterQuery);
  if (employeeSection.length == 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Section not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Section fetch successfully",
    employeeSection.map((section) => employeeDepartmentDTO(section)),
  );
});

// update section using slug
exports.updateEmployeeSection = asynchandeler(async (req, res) => {
  const section = await sectionModel.findOneAndUpdate(
    { slug: req.params.slug },
    req.body,
    { new: true },
  );
  if (!section) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Section not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Section updated successfully",
    employeeDepartmentDTO(section),
  );
});

// delete section using slug
exports.deleteEmployeeSection = asynchandeler(async (req, res) => {
  const section = await sectionModel.findOneAndDelete({
    slug: req.params.slug,
  });
  if (!section) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Section not found",
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Section deleted successfully",
    employeeDepartmentDTO(section),
  );
});
