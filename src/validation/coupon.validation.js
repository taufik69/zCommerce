const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const couponSchema = joi
  .object({
    code: joi.string().trim().uppercase().required().messages({
      "string.empty": "Coupon code is required.",
      "any.required": "Coupon code is required.",
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
    discountValue: joi.number().min(0).required().messages({
      "number.base": "Discount value must be a number.",
      "number.min": "Discount value must be positive.",
      "any.required": "Discount value is required.",
    }),
    minOrderAmount: joi.number().min(0).default(0).messages({
      "number.min": "Minimum order amount must be at least 0.",
    }),
    maxDiscountAmount: joi.number().min(0).allow(null).messages({
      "number.min": "Maximum discount amount must be at least 0.",
    }),
    couponStartAt: joi.date().required().messages({
      "date.base": "Invalid start date.",
      "any.required": "Coupon start date is required.",
    }),
    expireAt: joi
      .date()
      .greater(joi.ref("couponStartAt"))
      .required()
      .messages({
        "date.base": "Invalid expiry date.",
        "date.greater": "Expiry date must be after start date.",
        "any.required": "Expiry date is required.",
      }),
    usageLimit: joi.number().integer().min(1).allow(null).messages({
      "number.min": "Usage limit must be at least 1.",
    }),
    isActive: joi.boolean().default(true),
    applicableProducts: joi.array().items(joi.string().trim()).messages({
      "array.base": "Applicable products must be an array of IDs.",
    }),
    applicableCategories: joi.array().items(joi.string().trim()).messages({
      "array.base": "Applicable categories must be an array of IDs.",
    }),
    applicableSubCategories: joi.array().items(joi.string().trim()).messages({
      "array.base": "Applicable sub-categories must be an array of IDs.",
    }),
    applicableBrands: joi.array().items(joi.string().trim()).messages({
      "array.base": "Applicable brands must be an array of IDs.",
    }),
    applicableVariants: joi.array().items(joi.string().trim()).messages({
      "array.base": "Applicable variants must be an array of IDs.",
    }),
  })
  .options({ abortEarly: false, allowUnknown: true });

exports.validateCoupon = async (req, res, next) => {
  try {
    const value = await couponSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log(
      "Validation error " + error?.details?.map((err) => err.message),
    );
    return next(
      new customError(
        "Validation error " + error.details.map((err) => err.message),
        statusCodes.BAD_REQUEST,
      ),
    );
  }
};
