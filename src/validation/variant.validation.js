const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const VariantSchema = Joi.object({
  product: Joi.string().messages({
    "string.empty": "Product ID is required",
  }),
  // sku: Joi.string().trim().messages({
  //   "string.empty": "SKU is required",
  // }),
  variantName: Joi.string().trim().messages({
    "string.empty": "Variant name is required",
    "any.required": "Variant name is required",
  }),

  size: Joi.array().messages({
    "string.empty": "Size is required",

    "any.only": "Size must be one of S, M, L, XL, XXL, XXXL, Custom",
  }),
  color: Joi.array().messages({
    "string.empty": "Color is required",
    "any.required": "Color is required",
  }),
  stockVariant: Joi.number().min(0).messages({
    "number.base": "Stock variant must be a number",
    "number.min": "Stock variant cannot be less than 0",
  }),
  purchasePrice: Joi.number().min(0).messages({
    "number.base": "Purchase price must be a number",
    "number.min": "Purchase price cannot be less than 0",
  }),
  retailPrice: Joi.number().min(0).messages({
    "number.base": "Retail price must be a number",
    "number.min": "Retail price cannot be less than 0",
  }),
  retailProfitMarginbyPercentance: Joi.number()

    .min(0)
    .max(100)
    .messages({
      "number.base": "Retail profit margin must be a number",
      "number.min": "Retail profit margin cannot be less than 0",
      "number.max": "Retail profit margin cannot be more than 100",
    }),
  retailProfitMarginbyAmount: Joi.number().optional().min(0).messages({
    "number.base": "Retail profit margin by amount must be a number",
    "number.min": "Retail profit margin by amount cannot be less than 0",
  }),
  wholesalePrice: Joi.number().min(0).messages({
    "number.base": "Wholesale price must be a number",
    "number.min": "Wholesale price cannot be less than 0",
  }),
  wholesaleProfitMarginPercentage: Joi.number()

    .min(0)
    .max(100)
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
