const Joi = require("joi");

const VariantSchema = Joi.object({
  size: Joi.string().required().trim().messages({
    "string.empty": "Size is required",
    "any.required": "Size is required",
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
  variantBasePrice: Joi.number().required().min(0).messages({
    "number.base": "Variant base price must be a number",
    "number.min": "Variant base price cannot be less than 0",
    "any.required": "Variant base price is required",
  }),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean value",
  }),
}).options({ abortEarly: false });

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
