// validation/customer.validation.js
const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");

const bdMobileRegex = /^(01\d{9}|\+8801\d{9})$/;
const nidRegex = /^(\d{10}|\d{13}|\d{17})$/;

const customerCreateSchema = joi
  .object({
    customerId: joi.forbidden(),
    customerType: joi.string().trim().allow("").optional(),

    fullName: joi.string().trim().min(2).max(100).required().messages({
      "string.empty": "Full name is required.",
      "any.required": "Full name is required.",
      "string.min": "Full name must be at least 2 characters.",
      "string.max": "Full name cannot exceed 100 characters.",
    }),

    mobileNumber: joi
      .string()
      .trim()
      .pattern(bdMobileRegex)
      .required()
      .messages({
        "string.empty": "Mobile number is required.",
        "any.required": "Mobile number is required.",
        "string.pattern.base":
          "Mobile number must be a valid BD number (01XXXXXXXXX or +8801XXXXXXXXX).",
      }),

    occupation: joi.string().trim().allow("").optional(),

    nidNumber: joi
      .string()
      .trim()
      .pattern(nidRegex)
      .allow("")
      .optional()
      .messages({
        "string.pattern.base": "NID number must be 10, 13, or 17 digits.",
      }),

    openingDues: joi.number().min(0).default(0).messages({
      "number.base": "Opening dues must be a number.",
      "number.min": "Opening dues cannot be negative.",
    }),

    regularDiscountPercent: joi.number().min(0).max(100).default(0).messages({
      "number.base": "Regular discount must be a number.",
      "number.min": "Discount cannot be negative.",
      "number.max": "Discount cannot be more than 100.",
    }),

    emailAddress: joi
      .string()
      .trim()
      .lowercase()
      .email()
      .allow("")
      .optional()
      .messages({
        "string.email": "Please provide a valid email address.",
      }),

    remarks: joi.string().trim().max(1000).allow("").optional(),
    presentAddress: joi.string().trim().max(1000).allow("").optional(),
    permanentAddress: joi.string().trim().max(1000).allow("").optional(),

    isActive: joi.boolean().optional(),
    deletedAt: joi.forbidden(),
  })
  .options({ abortEarly: false, stripUnknown: true });

const validateCustomerImage = (req) => {
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

  if (file.size > 1 * 1024 * 1024) {
    throw new customError("Image size should be less than 1MB", 400);
  }

  const allowed = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (file.mimetype && !allowed.includes(file.mimetype)) {
    throw new customError(
      "Invalid image type. Allowed: PNG, JPG, GIF, WEBP, SVG",
      400,
    );
  }

  return file;
};

const buildJoiError = (error) => {
  if (!error?.details?.length) return "Validation error";
  return error.details.map((d) => d.message).join(", ");
};

//  Middleware style (req,res,next)
const validateCustomerCreate = async (req, res, next) => {
  try {
    const value = await customerCreateSchema.validateAsync(req.body);

    const imageFile = validateCustomerImage(req);
    if (imageFile) value.image = imageFile;

    req.body = value;
    return next();
  } catch (error) {
    console.log(error);
    apiResponse.sendError(res, 400, error.message || buildJoiError(error));
  }
};

// UPDATE
const validateCustomerUpdate = async (req, res, next) => {
  try {
    const value = await customerCreateSchema.validateAsync(req.body);

    const imageFile = validateCustomerImage(req);
    if (imageFile) value.image = imageFile;

    req.body = value;
    next();
  } catch (error) {
    apiResponse.sendError(res, 400, buildJoiError(error));
  }
};
module.exports = {
  validateCustomerCreate,
  validateCustomerUpdate,
};
