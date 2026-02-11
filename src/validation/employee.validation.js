const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["male", "female", "other"];

// BD phone simple: 01xxxxxxxxx (11 digit)
const bdMobileRegex = /^01\d{9}$/;

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

    designation: joi.string().allow("").trim().required().messages({
      "string.empty": "Designation is required.",
      "any.required": "Designation is required.",
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
  })
  .options({ abortEarly: false, allowUnknown: true });

/**
 * Update schema:
 * - required fields optional
 * - employeeId still forbidden (auto)
 */
const employeeUpdateSchema = employeeCreateSchema
  .fork(["fullName", "designation", "gender"], (schema) => schema.optional())
  .unknown(true);

const validateImageFile = (req, res, next) => {
  if (!req.files || req.files.length === 0) return null;

  if (req.files.length > 1) {
    return next(
      new customError(
        "You can upload a maximum of 1 image",
        statusCodes.BAD_REQUEST,
      ),
    );
  }

  const file = req.files[0];

  if (file.fieldname !== "image") {
    return next(
      new customError(
        "Please provide a valid image fieldName (image)",
        statusCodes.BAD_REQUEST,
      ),
    );
  }

  // 1MB example (তোমার UI screenshot এ max 1MB ছিল)
  if (file.size > 1 * 1024 * 1024) {
    return next(
      new customError(
        "Image size should be less than 1MB",
        statusCodes.BAD_REQUEST,
      ),
    );
  }

  // Optional mime check
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
  if (file.mimetype && !allowed.includes(file.mimetype)) {
    return next(
      new customError(
        "Invalid image type. Allowed: PNG, JPG, GIF, SVG",
        statusCodes.BAD_REQUEST,
      ),
    );
  }

  return file;
};

const buildJoiError = (error) => {
  if (!error?.details?.length) return "Validation error";
  return error.details.map((d) => d.message).join(", ");
};

//  CREATE VALIDATION
const validateEmployeeCreate = async (req, res, next) => {
  try {
    const value = await employeeCreateSchema.validateAsync(req.body);

    const imageFile = validateImageFile(req, res, next);
    if (imageFile) value.image = imageFile;

    return value;
  } catch (error) {
    console.log(error);
    apiResponse.sendError(
      res,
      statusCodes.BAD_REQUEST,
      error.message || buildJoiError(error),
    );
    throw new customError(buildJoiError(error), statusCodes.BAD_REQUEST);
  }
};

//  UPDATE VALIDATION
const validateEmployeeUpdate = async (req, res, next) => {
  try {
    const value = await employeeUpdateSchema.validateAsync(req.body);

    const imageFile = validateImageFile(req, res, next);
    if (imageFile) value.image = imageFile;

    return value;
  } catch (error) {
    apiResponse.sendError(
      res,
      statusCodes.BAD_REQUEST,
      error.message || buildJoiError(error),
    );
    throw new customError(buildJoiError(error), statusCodes.BAD_REQUEST);
  }
};

module.exports = {
  validateEmployeeCreate,
  validateEmployeeUpdate,
};
