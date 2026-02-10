const Joi = require("joi");

// YYYY-MM format
const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

exports.createEmployeeAdvancePaymentSchema = Joi.object({
  date: Joi.date().optional(), // default Date.now in mongoose
  month: Joi.string().pattern(monthRegex).required().messages({
    "string.pattern.base": "Month must be in YYYY-MM format",
    "any.required": "Month is required",
  }),

  employeeId: Joi.string().trim().required().messages({
    "any.required": "Employee ID is required",
  }),

  amount: Joi.number().positive().min(1).required().messages({
    "number.base": "Amount must be a number",
    "number.min": "Amount must be greater than 0",
    "any.required": "Amount is required",
  }),

  // balanceAmount: Joi.number().min(0).optional().messages({
  //   "number.min": "Balance amount cannot be negative",
  // }),

  paymentMode: Joi.string()
    .valid("cash", "bank", "bkash", "nagad", "rocket", "cheque", "other")
    .default("cash"),

  remarks: Joi.string().trim().max(500).allow("").optional(),

  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
}).options({ abortEarly: false, allowUnknown: true });

// Update schema (সব optional, but at least one field চাইলে নিচে .min(1) দাও)
exports.updateEmployeeAdvancePaymentSchema = Joi.object({
  date: Joi.date().optional(),
  month: Joi.string().pattern(monthRegex).optional(),
  employeeId: Joi.string().trim().optional(),
  amount: Joi.number().positive().min(1).optional(),
  balanceAmount: Joi.number().min(0).optional(),
  paymentMode: Joi.string()
    .valid("cash", "bank", "bkash", "nagad", "rocket", "cheque", "other")
    .optional(),
  remarks: Joi.string().trim().max(500).allow("").optional(),
  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
})
  .min(1) //  update এ খালি body পাঠালে error
  .options({ abortEarly: false, allowUnknown: true });
