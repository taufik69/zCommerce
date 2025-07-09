const joi = require("joi");
const { customError } = require("../lib/CustomError");

const couponSchema = joi
  .object({
    code: joi.string().trim().required().messages({
      "string.empty": "Code is required.",
      "any.required": "Code is required.",
    }),
    discountType: joi
      .string()
      .trim()
      .required()
      .valid("percentage", "fixed")
      .messages({
        "string.empty": "Discount type is required.",
        "any.required": "Discount type is required.",
        "any.only": "Discount type must be either 'percentage' or 'fixed'.",
      }),
    discountValue: joi.number().required().messages({
      "number.empty": "Discount value is required.",
      "any.required": "Discount value is required.",
    }),
    expireAt: joi.date().required().messages({
      "date.empty": "Expire at date is required.",
      "any.required": "Expire at date is required.",
    }),
    usageLimit: joi.number().integer().allow(null).messages({
      "number.empty": "Usage limit is required.",
      "any.required": "Usage limit is required.",
    }),
    usedCount: joi.number().integer().default(0).messages({
      "number.empty": "Used count is required.",
      "any.required": "Used count is required.",
    }),

    products: joi.array().items(joi.string().trim()).messages({
      "array.empty": "Products is required.",
      "any.required": "Products is required.",
    }),
    categories: joi.array().items(joi.string().trim()).messages({
      "array.empty": "Categories is required.",
      "any.required": "Categories is required.",
    }),
    subcategories: joi.array().items(joi.string().trim()).messages({
      "array.empty": "Subcategories is required.",
      "any.required": "Subcategories is required.",
    }),
  })
  .options({ abortEarly: false });

exports.validateCoupon = async (req) => {
  try {
    const value = await couponSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log("Validation error " + error.details.map((err) => err.message));
    throw new customError(
      "Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};
