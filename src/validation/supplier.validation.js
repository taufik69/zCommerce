const Joi = require("joi");

// Bangladesh mobile regex (same as mongoose)
const bdMobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * CREATE SUPPLIER
 */
exports.createSupplierSchema = Joi.object({
  supplierId: Joi.string().trim().pattern(bdMobileRegex).required().messages({
    "string.pattern.base":
      "Supplier ID must be a valid Bangladeshi mobile number",
    "any.required": "Supplier ID is required",
  }),

  supplierName: Joi.string().trim().min(2).max(120).required().messages({
    "string.base": "Supplier Name must be a string",
    "string.min": "Supplier Name must be at least 2 characters",
    "string.max": "Supplier Name cannot exceed 120 characters",
    "any.required": "Supplier Name is required",
  }),

  contactPersonName: Joi.string().trim().max(80).allow("").optional(),

  contactPersonDesignation: Joi.string().trim().max(80).allow("").optional(),

  mobile: Joi.string()
    .trim()
    .pattern(bdMobileRegex)
    .allow("")
    .optional()
    .messages({
      "string.pattern.base": "Mobile must be a valid Bangladeshi mobile number",
    }),

  supplierAddress: Joi.string().trim().max(300).allow("").optional(),

  openingDues: Joi.number().min(0).optional().messages({
    "number.min": "Opening dues cannot be negative",
  }),

  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/**
 * UPDATE SUPPLIER
 */
exports.updateSupplierSchema = Joi.object({
  supplierId: Joi.string().trim().pattern(bdMobileRegex).optional(),

  supplierName: Joi.string().trim().min(2).max(120).optional(),

  contactPersonName: Joi.string().trim().max(80).allow("").optional(),

  contactPersonDesignation: Joi.string().trim().max(80).allow("").optional(),

  mobile: Joi.string().trim().pattern(bdMobileRegex).allow("").optional(),

  supplierAddress: Joi.string().trim().max(300).allow("").optional(),

  openingDues: Joi.number().min(0).optional(),

  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
})
  .min(1) //  empty update body block
  .options({
    abortEarly: false,
    stripUnknown: true,
  });

// supplier due payment validation

exports.createSupplierDuePaymentSchema = Joi.object({
  transactionId: Joi.string().trim().optional(),
  date: Joi.date().optional(),
  supplierId: Joi.string().trim().required().messages({
    "any.required": "Supplier ID is required",
  }),

  paidAmount: Joi.number().min(0).required().messages({
    "number.base": "Paid amount must be a number",
    "number.min": "Paid amount cannot be negative",
    "any.required": "Paid amount is required",
  }),

  lessAmount: Joi.number().min(0).optional().messages({
    "number.min": "Less amount cannot be negative",
  }),

  paymentMode: Joi.string()
    .valid("cash", "bank", "bkash", "nagad", "rocket", "cheque", "other")
    .required()
    .messages({
      "any.only":
        "Payment mode must be cash, bank, bkash, nagad, rocket, cheque, or other",
      "any.required": "Payment mode is required",
    }),
  remarks: Joi.string().trim().max(500).allow("").optional(),
}).options({ abortEarly: false, stripUnknown: true });

//  Update Due Payment
exports.updateSupplierDuePaymentSchema = Joi.object({
  date: Joi.date().optional(),
  paidAmount: Joi.number().min(0).optional(),
  lessAmount: Joi.number().min(0).optional(),
  paymentMode: Joi.string()
    .valid("cash", "bank", "bkash", "nagad", "rocket", "cheque", "other")
    .optional(),
  remarks: Joi.string().trim().max(500).allow("").optional(),
  remainingDue: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  deletedAt: Joi.date().allow(null).optional(),
})
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });
