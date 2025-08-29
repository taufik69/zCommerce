const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const VariantSchema = Joi.object({
  product: Joi.string().required().messages({
    "string.empty": "Product ID is required",
    "any.required": "Product ID is required",
  }),
  variantName: Joi.string().trim().required().messages({
    "string.empty": "Variant name is required",
    "any.required": "Variant name is required",
  }),
  size: Joi.array().items(Joi.string()).messages({
    "array.base": "Size must be an array of strings",
  }),
  color: Joi.array().items(Joi.string()).messages({
    "array.base": "Color must be an array of strings",
  }),
  stockVariant: Joi.number().optional().min(0).messages({
    "number.base": "Stock variant must be a number",
    "number.min": "Stock variant cannot be less than 0",
    "any.required": "Stock variant is required",
  }),
  purchasePrice: Joi.number().min(0).required().messages({
    "number.base": "Purchase price must be a number",
    "number.min": "Purchase price cannot be less than 0",
    "any.required": "Purchase price is required",
  }),
  retailPrice: Joi.number().min(0).required().messages({
    "number.base": "Retail price must be a number",
    "number.min": "Retail price cannot be less than 0",
    "any.required": "Retail price is required",
  }),
  retailProfitMarginbyPercentance: Joi.number()
    .min(0)
    .max(100)
    .optional()
    .messages({
      "number.base": "Retail profit margin must be a number",
      "number.min": "Retail profit margin cannot be less than 0",
      "number.max": "Retail profit margin cannot be more than 100",
    }),
  retailProfitMarginbyAmount: Joi.number().optional().min(0).messages({
    "number.base": "Retail profit margin by amount must be a number",
    "number.min": "Retail profit margin by amount cannot be less than 0",
  }),
  wholesalePrice: Joi.number().min(0).optional().messages({
    "number.base": "Wholesale price must be a number",
    "number.min": "Wholesale price cannot be less than 0",
  }),
  wholesaleProfitMarginPercentage: Joi.number()
    .min(0)
    .max(100)
    .optional()
    .messages({
      "number.base": "Wholesale profit margin must be a number",
      "number.min": "Wholesale profit margin cannot be less than 0",
      "number.max": "Wholesale profit margin cannot be more than 100",
    }),
  wholesaleProfitMarginAmount: Joi.number().optional().min(0).messages({
    "number.base": "Wholesale profit margin by amount must be a number",
    "number.min": "Wholesale profit margin by amount cannot be less than 0",
  }),
  alertQuantity: Joi.number().optional().min(0).messages({
    "number.base": "Alert quantity must be a number",
    "number.min": "Alert quantity cannot be less than 0",
  }),
}).options({ abortEarly: false, allowUnknown: true });

const validateVariant = async (variantObj) => {
  try {
    return await VariantSchema.validateAsync(variantObj);
  } catch (error) {
    throw new customError(
      "Variant Validation error: " +
        error.details.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = validateVariant;
