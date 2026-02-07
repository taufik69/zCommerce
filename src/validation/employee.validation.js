const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["male", "female", "other"];

// BD phone simple: 01xxxxxxxxx (11 digit)
const bdMobileRegex = /^01\d{9}$/;
// NID: 10/13/17 digits (common in BD)
const nidRegex = /^(\d{10}|\d{13}|\d{17})$/;

const employeeCreateSchema = joi
  .object({
    // employeeId auto-generate হবে, তাই allow/strip
    employeeId: joi.forbidden(),

    fullName: joi.string().trim().min(2).max(100).required().messages({
      "string.empty": "Full name is required.",
      "any.required": "Full name is required.",
      "string.min": "Full name must be at least 2 characters.",
      "string.max": "Full name cannot exceed 100 characters.",
    }),

    nidNumber: joi.string().trim().pattern(nidRegex).optional().messages({
      "string.pattern.base": "NID number must be 10, 13, or 17 digits.",
    }),

    designation: joi.string().trim().required().messages({
      "string.empty": "Designation is required.",
      "any.required": "Designation is required.",
    }),

    educationalQualification: joi.string().trim().required().messages({
      "string.empty": "Educational qualification is required.",
      "any.required": "Educational qualification is required.",
    }),

    dateOfBirth: joi.date().required().messages({
      "date.base": "Date of birth must be a valid date.",
      "any.required": "Date of birth is required.",
    }),

    gender: joi
      .string()
      .trim()
      .valid(...GENDERS)
      .required()
      .messages({
        "any.only": "Gender must be male, female, or other.",
        "any.required": "Gender is required.",
        "string.empty": "Gender is required.",
      }),

    bloodGroup: joi
      .string()
      .trim()
      .valid(...BLOOD_GROUPS)
      .optional()
      .messages({
        "any.only": "Invalid blood group.",
      }),

    mobile: joi.string().trim().pattern(bdMobileRegex).required().messages({
      "string.empty": "Mobile number is required.",
      "any.required": "Mobile number is required.",
      "string.pattern.base":
        "Mobile number must be a valid BD number (01XXXXXXXXX).",
    }),

    secondaryMobile: joi
      .string()
      .trim()
      .pattern(bdMobileRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Secondary mobile must be a valid BD number (01XXXXXXXXX).",
      }),

    email: joi
      .string()
      .trim()
      .lowercase()
      .email()
      .allow("")
      .optional()
      .messages({
        "string.email": "Please provide a valid email address.",
      }),

    joiningDate: joi.date().optional().messages({
      "date.base": "Joining date must be a valid date.",
    }),

    salary: joi
      .object({
        basicSalary: joi.number().min(0).default(0),
        houseRent: joi.number().min(0).default(0),
        medicalAllowance: joi.number().min(0).default(0),
        othersAllowance: joi.number().min(0).default(0),
        specialAllowance: joi.number().min(0).default(0),
        providentFund: joi.number().min(0).default(0),
      })
      .optional(),

    // soft delete fields/backend controlled
    isActive: joi.boolean().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

/**
 * Update schema:
 * - required fields optional
 * - employeeId still forbidden (auto)
 */
const employeeUpdateSchema = employeeCreateSchema.fork(
  [
    "fullName",
    "designation",
    "educationalQualification",
    "dateOfBirth",
    "gender",
    "mobile",
  ],
  (schema) => schema.optional(),
);

const validateImageFile = (req) => {
  if (!req.files || req.files.length === 0) return null;

  if (req.files.length > 1) {
    throw new customError("You can upload a maximum of 1 image", 400);
  }

  const file = req.files[0];

  if (file.fieldname !== "image") {
    throw new customError(
      "Please provide a valid image fieldName (image)",
      400,
    );
  }

  // 1MB example (তোমার UI screenshot এ max 1MB ছিল)
  if (file.size > 1 * 1024 * 1024) {
    throw new customError("Image size should be less than 1MB", 400);
  }

  // Optional mime check
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
  if (file.mimetype && !allowed.includes(file.mimetype)) {
    throw new customError(
      "Invalid image type. Allowed: PNG, JPG, GIF, SVG",
      400,
    );
  }

  return file;
};

const buildJoiError = (error) => {
  if (!error?.details?.length) return "Validation error";
  return error.details.map((d) => d.message).join(", ");
};

//  CREATE VALIDATION
const validateEmployeeCreate = async (req) => {
  try {
    const value = await employeeCreateSchema.validateAsync(req.body);

    const imageFile = validateImageFile(req);
    if (imageFile) value.image = imageFile;

    return value;
  } catch (error) {
    console.log(error);
    apiResponse.sendError(res, 400, error.message || buildJoiError(error));
    throw new customError(buildJoiError(error), 400);
  }
};

//  UPDATE VALIDATION
const validateEmployeeUpdate = async (req) => {
  try {
    const value = await employeeUpdateSchema.validateAsync(req.body);

    const imageFile = validateImageFile(req);
    if (imageFile) value.image = imageFile;

    return value;
  } catch (error) {
    throw new customError(buildJoiError(error), 400);
  }
};

module.exports = {
  validateEmployeeCreate,
  validateEmployeeUpdate,
};
