const Joi = require("joi");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");

const bdMobileRegex = /^(01\d{9}|\+8801\d{9})$/;
const nidRegex = /^(\d{10}|\d{13}|\d{17})$/;

const PAYMENT_MODES = [
  "cash",
  "bank",
  "bkash",
  "nagad",
  "rocket",
  "cheque",
  "other",
];

const customerCreateSchema = Joi.object({
  customerId: Joi.forbidden(),
  customerType: Joi.string().trim().allow("").optional(),

  fullName: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Full name is required.",
    "any.required": "Full name is required.",
    "string.min": "Full name must be at least 2 characters.",
    "string.max": "Full name cannot exceed 100 characters.",
  }),

  mobileNumber: Joi.string().trim().pattern(bdMobileRegex).required().messages({
    "string.empty": "Mobile number is required.",
    "any.required": "Mobile number is required.",
    "string.pattern.base":
      "Mobile number must be a valid BD number (01XXXXXXXXX or +8801XXXXXXXXX).",
  }),

  occupation: Joi.string().trim().allow("").optional(),

  nidNumber: Joi.string()
    .trim()
    .pattern(nidRegex)
    .allow("")
    .optional()
    .messages({
      "string.pattern.base": "NID number must be 10, 13, or 17 digits.",
    }),

  openingDues: Joi.number().min(0).default(0).messages({
    "number.base": "Opening dues must be a number.",
    "number.min": "Opening dues cannot be negative.",
  }),

  regularDiscountPercent: Joi.number().min(0).max(100).default(0).messages({
    "number.base": "Regular discount must be a number.",
    "number.min": "Discount cannot be negative.",
    "number.max": "Discount cannot be more than 100.",
  }),

  emailAddress: Joi.string()
    .trim()
    .lowercase()
    .email()
    .allow("")
    .optional()
    .messages({
      "string.email": "Please provide a valid email address.",
    }),

  remarks: Joi.string().trim().max(1000).allow("").optional(),
  presentAddress: Joi.string().trim().max(1000).allow("").optional(),
  permanentAddress: Joi.string().trim().max(1000).allow("").optional(),
}).options({ abortEarly: false, stripUnknown: true });

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

// Create Schema
const createCustomerPaymentSchema = Joi.object({
  customer: Joi.string().trim().required().messages({
    "string.empty": "Customer id is required.",
    "any.required": "Customer id is required.",
  }),

  referenceInvoice: Joi.string().trim().allow("").optional(),

  paidAmount: Joi.number().min(0).default(0).messages({
    "number.base": "Paid amount must be a number",
    "number.min": "Paid amount cannot be negative",
  }),

  lessAmount: Joi.number().min(0).default(0).messages({
    "number.base": "Less amount must be a number",
    "number.min": "Less amount cannot be negative",
  }),

  cashBack: Joi.number().min(0).default(0).messages({
    "number.base": "Cash back must be a number",
    "number.min": "Cash back cannot be negative",
  }),

  paymentMode: Joi.string()
    .valid(...PAYMENT_MODES)
    .default("cash")
    .messages({
      "any.only":
        "Payment mode must be cash, bank, bkash, nagad, rocket, cheque or other",
    }),

  remarks: Joi.string().trim().max(500).allow("").optional(),

  // system fields
  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
}).options({ abortEarly: false, stripUnknown: true });

// Update Schema (all optional but at least one required)
const updateCustomerPaymentSchema = Joi.object({
  customer: Joi.string().trim().optional(),
  referenceInvoice: Joi.string().trim().allow("").optional(),
  paidAmount: Joi.number().min(0).optional(),
  lessAmount: Joi.number().min(0).optional(),
  cashBack: Joi.number().min(0).optional(),
  date: Joi.date().optional(),
  paymentMode: Joi.string()
    .valid(...PAYMENT_MODES)
    .optional(),
  remarks: Joi.string().trim().max(500).allow("").optional(),
  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
})
  .min(1) // prevent empty update body
  .options({ abortEarly: false, stripUnknown: true });

// custoemr advance payment validation schema
const createCustomerAdvancePaymentSchema = Joi.object({
  customer: Joi.string().trim().required().messages({
    "string.empty": "Customer name is required",
    "any.required": "Customer name is required",
  }),

  balance: Joi.number().min(0).default(0).messages({
    "number.base": "Balance must be a number",
    "number.min": "Balance cannot be negative",
  }),

  paidAmount: Joi.number().positive().min(1).required().messages({
    "number.base": "Paid amount must be a number",
    "number.min": "Paid amount must be greater than 0",
    "any.required": "Paid amount is required",
  }),

  advanceCashBack: Joi.number().min(0).default(0).messages({
    "number.base": "Advance cash back must be a number",
    "number.min": "Advance cash back cannot be negative",
  }),

  paymentMode: Joi.string()
    .valid(...PAYMENT_MODES)
    .default("cash")
    .messages({
      "any.only":
        "Payment mode must be cash, bank, bkash, nagad, rocket, cheque or other",
    }),

  remarks: Joi.string().trim().max(500).allow("").optional(),
}).options({ abortEarly: false, stripUnknown: true });

// =============================
// UPDATE SCHEMA
// =============================
const updateCustomerAdvancePaymentSchema = Joi.object({
  customer: Joi.string().trim().optional(),

  balance: Joi.number().min(0).optional(),

  paidAmount: Joi.number().positive().min(1).optional(),

  advanceCashBack: Joi.number().min(0).optional(),

  paymentMode: Joi.string()
    .valid(...PAYMENT_MODES)
    .optional(),

  remarks: Joi.string().trim().max(500).allow("").optional(),
})
  .min(1) // prevent empty update body
  .options({ abortEarly: false, stripUnknown: true });
module.exports = {
  validateCustomerCreate,
  validateCustomerUpdate,
  createCustomerPaymentSchema,
  updateCustomerPaymentSchema,
  createCustomerAdvancePaymentSchema,
  updateCustomerAdvancePaymentSchema,
};
