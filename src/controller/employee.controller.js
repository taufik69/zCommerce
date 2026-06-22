const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const mongoose = require("mongoose");
const {
  validateEmployeeCreate,
  validateEmployeeUpdate,
} = require("../validation/employee.validation");
const employeeModel = require("../models/employee.model");
const {
  employeeAdvancePayment,
  employeeDesignationModel,
  departmentModel,
  sectionModel,
} = require("../models/advancePayment.model");
const { deleteCloudinaryFile } = require("../helpers/cloudinary");
const {
  employeeAdvancePaymentDTO,
  employeeDesignationDTO,
  employeeDepartmentDTO,
} = require("../dtos/all.dto");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("../utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");

// ─── cache constants ──────────────────────────────────────────────────────────
const NS_EMPLOYEE = "employee";
const NS_DESIGNATION = "designation";
const NS_DEPARTMENT = "department";
const NS_SECTION = "section";
const NS_ADVANCE = "employeeAdvance";
const CACHE_TTL = 60 * 60; // 1 hour

//  CREATE EMPLOYEE
exports.createEmployee = asynchandeler(async (req, res, next) => {
  const value = await validateEmployeeCreate(req, res, next);

  const imageFile = value.image;
  const certImageFiles = value.certImageFiles || {};
  delete value.image;
  delete value.certImageFiles;

  // Seed pending image subdoc for each cert that has a file
  if (value.certifications && value.certifications.length > 0) {
    value.certifications = value.certifications.map((cert, i) => ({
      ...cert,
      ...(certImageFiles[i]
        ? { image: { status: "pending", localPath: certImageFiles[i].path } }
        : {}),
    }));
  }

  const newEmployee = await employeeModel.create({
    ...value,
    image: imageFile
      ? { status: "pending", localPath: imageFile.path }
      : {},
  });

  if (imageFile) {
    await imageQueue.add("create-employee-image", {
      modelName: NS_EMPLOYEE,
      documentId: newEmployee._id,
      localPath: imageFile.path,
    });
  }

  // Enqueue cert image uploads
  for (const [idxStr, certFile] of Object.entries(certImageFiles)) {
    const idx = Number(idxStr);
    await imageQueue.add("create-employee-cert-image", {
      modelName: NS_EMPLOYEE,
      documentId: newEmployee._id,
      localPath: certFile.path,
      fieldName: `certifications.${idx}.image`,
    });
  }

  await bumpNsVersion(NS_EMPLOYEE);

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Employee created successfully",
    newEmployee,
  );
});

// get all employee or single employee by id
exports.getEmployeeList = asynchandeler(async (req, res) => {
  if (req.query.id) {
    const cacheKey = await buildCacheKey(NS_EMPLOYEE, `id:${req.query.id}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Employee fetch successfully",
        { employee: cached, fromCache: true },
      );
    }

    const employee = await employeeModel
      .findOne({ employeeId: req.query.id })
      .populate("designation")
      .populate("deapartment")
      .populate("section");

    if (!employee) {
      apiResponse.sendError(res, statusCodes.NOT_FOUND, "Employee not found");
      return;
    }

    await setCache(cacheKey, employee, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee fetch successfully",
      { employee, fromCache: false },
    );
  }

  const cacheKey = await buildCacheKey(NS_EMPLOYEE, "all");
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Employee list fetch successfully",
      {
        count: cached.length,
        employees: cached,
        fromCache: true,
      },
    );
  }

  const employeeList = await employeeModel
    .find()
    .populate("designation")
    .populate("deapartment")
    .populate("section")
    .sort({ createdAt: -1 });

  await setCache(cacheKey, employeeList, CACHE_TTL);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Employee list fetch successfully", {
    count: employeeList.length,
    employees: employeeList,
    fromCache: false,
  });
});

// UPDATE EMPLOYEE
exports.updateEmployee = asynchandeler(async (req, res, next) => {
  const value = await validateEmployeeUpdate(req, res, next);

  delete value.employeeId;
  delete value.createdAt;
  delete value.updatedAt;

  const employee = await employeeModel.findOne({ employeeId: req.params.id });
  if (!employee) {
    return apiResponse.sendError(res, statusCodes.NOT_FOUND, "Employee not found");
  }

  const { image: imageFile, certImageFiles = {}, ...rest } = value;

  if (imageFile) {
    const oldPublicId = employee.image?.publicId || null;

    rest["image.status"] = "pending";
    rest["image.localPath"] = imageFile.path;
    rest["image.tries"] = 0;
    rest["image.lastError"] = "";

    await imageQueue.add("update-employee-image", {
      modelName: NS_EMPLOYEE,
      documentId: employee._id,
      localPath: imageFile.path,
      oldPublicId,
    });
  }

  // Build cert image dot-path updates separately — cannot mix "certifications"
  // array key and "certifications.N.*" dot-paths in the same $set (MongoDB conflict).
  const certImageUpdate = {};
  for (const [idxStr, certFile] of Object.entries(certImageFiles)) {
    const idx = Number(idxStr);
    const oldPublicId = employee.certifications?.[idx]?.image?.publicId || null;
    certImageUpdate[`certifications.${idx}.image.status`] = "pending";
    certImageUpdate[`certifications.${idx}.image.localPath`] = certFile.path;
    certImageUpdate[`certifications.${idx}.image.tries`] = 0;
    certImageUpdate[`certifications.${idx}.image.lastError`] = "";

    await imageQueue.add("update-employee-cert-image", {
      modelName: NS_EMPLOYEE,
      documentId: employee._id,
      localPath: certFile.path,
      fieldName: `certifications.${idx}.image`,
      oldPublicId,
    });
  }

  // Recalculate grossSalary manually since findByIdAndUpdate bypasses pre-save hooks
  if (rest.salary || Object.keys(rest).some((k) => k.startsWith("salary."))) {
    const merged = {
      basicSalary: 0,
      houseRent: 0,
      medicalAllowance: 0,
      othersAllowance: 0,
      specialAllowance: 0,
      providentFund: 0,
      ...employee.salary?.toObject?.() ?? employee.salary ?? {},
      ...(rest.salary ?? {}),
    };
    rest["salary.grossSalary"] =
      Number(merged.basicSalary) +
      Number(merged.houseRent) +
      Number(merged.medicalAllowance) +
      Number(merged.othersAllowance) +
      Number(merged.specialAllowance) -
      Number(merged.providentFund);
    delete rest.salary;
  }

  // First update: all scalar/array fields (includes certifications array as-is)
  await employeeModel.findByIdAndUpdate(
    employee._id,
    { $set: rest },
    { runValidators: true },
  );

  // Second update: cert image dot-paths (separate to avoid $set conflict)
  if (Object.keys(certImageUpdate).length > 0) {
    await employeeModel.findByIdAndUpdate(
      employee._id,
      { $set: certImageUpdate },
    );
  }

  const updatedEmployee = await employeeModel.findById(employee._id);

  await bumpNsVersion(NS_EMPLOYEE);

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Employee updated successfully",
    updatedEmployee,
  );
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

  const publicId = employee.image?.publicId;
  if (publicId) {
    try {
      await deleteCloudinaryFile(publicId);
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

  // Invalidate employee cache
  await bumpNsVersion(NS_EMPLOYEE);
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

  // Invalidate employee cache
  await bumpNsVersion(NS_EMPLOYEE);
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
        .findOne({ _id: employeeId })
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
        { _id: employeeId },
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

    // Invalidate caches
    await bumpNsVersion(NS_ADVANCE);
    await bumpNsVersion(NS_EMPLOYEE);

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

  const cacheKey = await buildCacheKey(
    NS_ADVANCE,
    employeeId ? `employee:${employeeId}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Advance Payment fetch successfully",
      {
        employeeAdvancePayments: cached,
        fromCache: true,
      },
    );
  }

  let filterQuery = {};
  if (employeeId) {
    filterQuery.employeeId = employeeId; // Fixed: filter by employeeId, not _id
  }

  const employeeAdvancePaymentDoc = await employeeAdvancePayment
    .find(filterQuery)
    .populate("employeeId");

  if (!employeeAdvancePaymentDoc || employeeAdvancePaymentDoc.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Advance Payment not found",
    );
  }

  const dto = employeeAdvancePaymentDoc.map((doc) =>
    employeeAdvancePaymentDTO(doc),
  );

  await setCache(cacheKey, dto, CACHE_TTL);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Advance Payment fetch successfully",
    {
      employeeAdvancePayments: dto,
      fromCache: false,
    },
  );
});

// update advance payemnt
exports.updateEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePayment.findOneAndUpdate(
    { _id: req.params.id },
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

  // Invalidate caches
  await bumpNsVersion(NS_ADVANCE);
  await bumpNsVersion(NS_EMPLOYEE);
});

// delete advance payment
exports.deleteEmployeeAdvancePayment = asynchandeler(async (req, res) => {
  const advancePayment = await employeeAdvancePayment.findOneAndDelete({
    _id: req.params.id,
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

  // Invalidate caches
  await bumpNsVersion(NS_DESIGNATION);
  await bumpNsVersion(NS_EMPLOYEE); // Employee list populates designation
});

//  get all employee designation or get designnation using slug by req.query
exports.getEmployeeDesignation = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  const cacheKey = await buildCacheKey(
    NS_DESIGNATION,
    slug ? `slug:${slug}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    const dataKey = slug ? "designation" : "designations";
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Designation fetch successfully",
      {
        [dataKey]: cached,
        fromCache: true,
      },
    );
  }

  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  }

  const employeeDesignation = await employeeDesignationModel.find(filterQuery);
  if (!employeeDesignation || employeeDesignation.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Designation not found",
    );
  }

  const dto = employeeDesignation.map((designation) =>
    employeeDesignationDTO(designation),
  );

  // If single, store the object, else store the array
  const dataToCache = slug ? dto[0] : dto;
  await setCache(cacheKey, dataToCache, CACHE_TTL);

  const dataKey = slug ? "designation" : "designations";
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Designation fetch successfully",
    {
      [dataKey]: slug ? dto[0] : dto,
      fromCache: false,
    },
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

  // Invalidate caches
  await bumpNsVersion(NS_DESIGNATION);
  await bumpNsVersion(NS_EMPLOYEE);
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

  // Invalidate caches
  await bumpNsVersion(NS_DEPARTMENT);
  await bumpNsVersion(NS_EMPLOYEE);
});

// get all deapartment or get department using slug by req.query
exports.getEmployeeDepartment = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  const cacheKey = await buildCacheKey(
    NS_DEPARTMENT,
    slug ? `slug:${slug}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    const dataKey = slug ? "department" : "departments";
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Department fetch successfully",
      {
        [dataKey]: cached,
        fromCache: true,
      },
    );
  }

  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  }

  const employeeDepartment = await departmentModel.find(filterQuery);
  if (!employeeDepartment || employeeDepartment.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Department not found",
    );
  }

  const dto = employeeDepartment.map((department) =>
    employeeDepartmentDTO(department),
  );

  const dataToCache = slug ? dto[0] : dto;
  await setCache(cacheKey, dataToCache, CACHE_TTL);

  const dataKey = slug ? "department" : "departments";
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Department fetch successfully",
    {
      [dataKey]: slug ? dto[0] : dto,
      fromCache: false,
    },
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

  // Invalidate caches
  await bumpNsVersion(NS_DEPARTMENT);
  await bumpNsVersion(NS_EMPLOYEE);
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

  // Invalidate caches
  await bumpNsVersion(NS_SECTION);
  await bumpNsVersion(NS_EMPLOYEE);
});

// get all section list or get section using slug by req.query
exports.getEmployeeSection = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  const cacheKey = await buildCacheKey(
    NS_SECTION,
    slug ? `slug:${slug}` : "all",
  );
  const cached = await getCache(cacheKey);
  if (cached) {
    const dataKey = slug ? "section" : "sections";
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Section fetch successfully",
      {
        [dataKey]: cached,
        fromCache: true,
      },
    );
  }

  let filterQuery = {};
  if (slug) {
    filterQuery.slug = slug;
  }

  const employeeSection = await sectionModel.find(filterQuery);
  if (!employeeSection || employeeSection.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Section not found",
    );
  }

  const dto = employeeSection.map((section) => employeeDepartmentDTO(section));

  const dataToCache = slug ? dto[0] : dto;
  await setCache(cacheKey, dataToCache, CACHE_TTL);

  const dataKey = slug ? "section" : "sections";
  apiResponse.sendSuccess(res, statusCodes.OK, "Section fetch successfully", {
    [dataKey]: slug ? dto[0] : dto,
    fromCache: false,
  });
});

// update section using slug  and add caching
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

  // Invalidate caches
  await bumpNsVersion(NS_SECTION);
  await bumpNsVersion(NS_EMPLOYEE);
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
