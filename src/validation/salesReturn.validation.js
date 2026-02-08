const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const byReturnSchema = joi
  .object(
    {
      product: joi
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)

        .messages({
          "string.empty": "Product is required.",
          "string.pattern.base": "Product must be a valid ObjectId.",
          "any.required": "Product is required.",
        }),

      variant: joi
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)

        .messages({
          "string.empty": "Variant is required.",
          "string.pattern.base": "Variant must be a valid ObjectId.",
        }),

      productBarCode: joi.string().trim().min(3).max(50).messages({
        "string.empty": "Product barcode is required.",
        "any.required": "Product barcode is required.",
      }),

      quantity: joi.number().integer().min(1).required().messages({
        "number.base": "Quantity must be a number.",
        "number.min": "Quantity must be at least 1.",
        "any.required": "Quantity is required.",
      }),

      cashReturnMode: joi.string().messages({
        "any.only": "Cash return mode must be cash, bank, or mobile_banking.",
        "any.required": "Cash return mode is required.",
      }),
    },
    {
      allowUnknown: true,
      abortEarly: false,
    },
  )
  .unknown(true);

exports.validateByReturn = async (req) => {
  try {
    const value = await byReturnSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    if (error.details) {
      console.log(
        "Validation error: " + error.details.map((err) => err.message),
      );
      throw new customError(
        "Validation error: " + error.details.map((err) => err.message),
        statusCodes.BAD_REQUEST,
      );
    }
    throw error;
  }
};
