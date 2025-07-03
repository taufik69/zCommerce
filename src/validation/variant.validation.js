const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const VariantSchema = Joi.object({
  variantName: Joi.string().required().trim().messages({
    "string.empty": "Variant name is required",
    "any.required": "Variant name is required",
  }),
  size: Joi.string()
    .required()
    .valid("S", "M", "L", "XL", "XXL", "XXXL", "Custom")
    .messages({
      "string.empty": "Size is required",
      "any.required": "Size is required",
      "any.only": "Size must be one of S, M, L, XL, XXL, XXXL, Custom",
    }),
  color: Joi.string().required().trim().messages({
    "string.empty": "Color is required",
    "any.required": "Color is required",
  }),
  stockVariant: Joi.number().required().min(0).messages({
    "number.base": "Stock variant must be a number",
    "number.min": "Stock variant cannot be less than 0",
    "any.required": "Stock variant is required",
  }),
  retailPrice: Joi.number().required().min(0).messages({
    "number.base": "Retail price must be a number",
    "number.min": "Retail price cannot be less than 0",
    "any.required": "Retail price is required",
  }),
  retailProfitMargin: Joi.number().required().min(0).max(100).messages({
    "number.base": "Retail profit margin must be a number",
    "number.min": "Retail profit margin cannot be less than 0",
    "number.max": "Retail profit margin cannot be more than 100",
    "any.required": "Retail profit margin is required",
  }),
  wholesalePrice: Joi.number().required().min(0).messages({
    "number.base": "Wholesale price must be a number",
    "number.min": "Wholesale price cannot be less than 0",
    "any.required": "Wholesale price is required",
  }),
  wholesaleProfitMargin: Joi.number().required().min(0).max(100).messages({
    "number.base": "Wholesale profit margin must be a number",
    "number.min": "Wholesale profit margin cannot be less than 0",
    "number.max": "Wholesale profit margin cannot be more than 100",
    "any.required": "Wholesale profit margin is required",
  }),
  alertVariantStock: Joi.number().required().min(5).messages({
    "number.base": "Alert variant stock must be a number",
    "number.min": "Alert variant stock cannot be less than 5",
    "any.required": "Alert variant stock is required",
  }),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean value",
  }),
}).options({ abortEarly: false, allowUnknown: true });

const validateVariant = async (req) => {
  try {
    const value = await VariantSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log(
      "Variant Validation error: " +
        error.details.map((err) => err.message).join(", ")
    );
    throw new customError(
      "Variant Validation error: " +
        error.details.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = validateVariant;
