const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const salesReturnSchema = joi.object({


  invoiceNumber: joi
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Invoice number is required.",
      "string.pattern.base": "Invoice number must be a valid ObjectId.",
      "any.required": "Invoice number is required.",
    }),

  refundMethod: joi
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Refund method is required.",
      "string.pattern.base": "Refund method must be a valid ObjectId.",
      "any.required": "Refund method is required.",
    }),

  returnReason: joi.string().trim().required().messages({
    "string.empty": "Return reason is required.",
    "any.required": "Return reason is required.",
  }),

  allproduct: joi
    .array()
    .items(
      joi.object({
        product: joi
          .string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required(),
        variant: joi
          .string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .allow(null, ""),
        quantity: joi.number().min(1).required(),
        unitPrice: joi.number().min(0).required(),
        subtotal: joi.number().min(0).required(),
      }),
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one product is required for return.",
      "any.required": "Products are required.",
    }),

  totalReturnAmount: joi.number().min(0).required().messages({
    "number.base": "Total return amount must be a number.",
    "any.required": "Total return amount is required.",
  }),

  remarks: joi.string().trim().allow(""),
  
  date: joi.date().allow(""),
});

exports.validateSalesReturn = async (req) => {
  try {
    const value = await salesReturnSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });
    return value;
  } catch (error) {
    if (error.details) {
      const errorMessage = error.details.map((err) => err.message).join(", ");
      throw new customError(errorMessage, statusCodes.BAD_REQUEST);
    }
    throw error;
  }
};
