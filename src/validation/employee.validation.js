const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { expandBracketKeys } = require("../utils/parseFormData.util");

const GENDERS = ["male", "female", "other"];

const employeeCreateSchema = joi
  .object({
    employeeId: joi.forbidden(),

    fullName: joi.string().trim().min(2).max(100).required().messages({
      "string.empty": "Full name is required.",
      "any.required": "Full name is required.",
      "string.min": "Full name must be at least 2 characters.",
      "string.max": "Full name cannot exceed 100 characters.",
    }),

    designation: joi
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
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

    certifications: joi
      .array()
      .items(
        joi.object({
          title: joi.string().trim().allow("").optional(),
          institute: joi.string().trim().allow("").optional(),
          year: joi.string().trim().allow("").optional(),
          details: joi.string().trim().allow("").optional(),
        }),
      )
      .optional(),
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

// Extract profile image (fieldname === "image") from req.files array (upload.any())
const extractImageFile = (req) => {
  if (!req.files || req.files.length === 0) return null;
  return req.files.find((f) => f.fieldname === "image") || null;
};

// Extract cert images: certImage_0, certImage_1, … → { 0: file, 1: file, … }
const extractCertImageFiles = (req) => {
  if (!req.files || req.files.length === 0) return {};
  const map = {};
  req.files.forEach((f) => {
    const match = f.fieldname.match(/^certImage_(\d+)$/);
    if (match) map[Number(match[1])] = f;
  });
  return map;
};

const buildJoiError = (error) => {
  if (!error?.details?.length) return "Validation error";
  return error.details.map((d) => d.message).join(", ");
};

//  CREATE VALIDATION
const validateEmployeeCreate = async (req, res, next) => {
  try {
    const expanded = expandBracketKeys(req.body);
    const value = await employeeCreateSchema.validateAsync(expanded);

    const imageFile = extractImageFile(req);
    if (imageFile) value.image = imageFile;

    value.certImageFiles = extractCertImageFiles(req);

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
    const expanded = expandBracketKeys(req.body);
    const value = await employeeUpdateSchema.validateAsync(expanded);

    const imageFile = extractImageFile(req);
    if (imageFile) value.image = imageFile;

    value.certImageFiles = extractCertImageFiles(req);

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
