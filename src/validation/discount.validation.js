const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const discountSchema = Joi.object({
  discountValidFrom: Joi.date().required().messages({
    "date.base": "Discount valid from must be a valid date",
    "any.required": "Discount valid from is required",
  }),
  discountValidTo: Joi.date()
    .required()
    .greater(Joi.ref("discountValidFrom"))
    .messages({
      "date.base": "Discount valid to must be a valid date",
      "date.greater":
        "Discount valid to must be later than discount valid from",
      "any.required": "Discount valid to is required",
    }),
  discountName: Joi.string().required().trim().messages({
    "string.empty": "Discount name is required",
    "any.required": "Discount name is required",
  }),
  discountType: Joi.string().valid("tk", "percentance").required().messages({
    "any.only": "Discount type must be either 'tk' or 'percentance'",
    "any.required": "Discount type is required",
  }),
  discountValueByAmount: Joi.number().min(0).messages({
    "number.base": "Discount value by amount must be a number",
    "number.min": "Discount value by amount cannot be less than 0",
  }),
  discountValueByPercentance: Joi.number().min(0).messages({
    "number.base": "Discount value by percentage must be a number",
    "number.min": "Discount value by percentage cannot be less than 0",
  }),
  discountPlan: Joi.string()
    .valid("flat", "category", "product")
    .required()
    .messages({
      "any.only":
        "Discount plan must be one of 'flat', 'category', or 'product'",
      "any.required": "Discount plan is required",
    }),
  targetCategory: Joi.string().optional().messages({
    "string.base": "Target category must be a valid ID",
  }),
  targetProduct: Joi.string().allow(null).optional().messages({
    "string.base": "Target product must be a valid ID",
  }),
}).options({ abortEarly: false }); // Validate all fields, not just the first error

const validateDiscount = async (req) => {
  try {
    const value = await discountSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log(
      "Discount Validation error: " +
        error.details.map((err) => err.message).join(", ")
    );
    throw new customError(
      "Discount Validation error: " +
        error.details.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = validateDiscount;
