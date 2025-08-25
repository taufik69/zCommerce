const joi = require("joi");
const { customError } = require("../lib/CustomError");

const merchantSchema = joi.object(
  {
    merchantID: joi.string().trim().required().messages({
      "string.empty": "Merchant ID is required.",
      "any.required": "Merchant ID is required.",
    }),
    merchantSecret: joi.string().trim().required().messages({
      "string.empty": "Merchant Secret is required.",
      "any.required": "Merchant Secret is required.",
    }),
    baseURL: joi.string().trim().uri().messages({
      "string.empty": "Base URL is required.",
      "string.uri": "Base URL must be a valid URL.",
    }),
    serviceProvider: joi.string().trim().required().messages({
      "string.empty": "Service Provider is required.",
      "any.required": "Service Provider is required.",
    }),
    merchantName: joi.string().trim().required().messages({
      "string.empty": "Merchant Name is required.",
      "any.required": "Merchant Name is required.",
    }),
    merchantEmail: joi
      .string()
      .trim()
      .required()
      .email()
      .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com)$/)
      .messages({
        "string.empty": "Merchant Email is required.",
        "any.required": "Merchant Email is required.",
        "string.email": "Merchant Email must be a valid email address.",
        "string.pattern.base": "Merchant Email must end with .com",
      }),
    merchantPhone: joi
      .string()
      .trim()
      .required()
      .pattern(/^01[0-9]{9}$/)
      .messages({
        "string.empty": "Merchant Phone is required.",
        "any.required": "Merchant Phone is required.",
        "string.pattern.base":
          "Merchant Phone must be a valid Bangladeshi phone number starting with 01.",
      }),
    merchantsecondary_contact: joi
      .string()
      .trim()
      .required()
      .pattern(/^01[0-9]{9}$/)
      .messages({
        "string.empty": "Merchant Secondary Contact is required.",
        "any.required": "Merchant Secondary Contact is required.",
        "string.pattern.base":
          "Merchant Secondary Contact must be a valid Bangladeshi phone number starting with 01.",
      }),
    merchantAdress: joi.string().trim().required().messages({
      "string.empty": "Merchant Address is required.",
      "any.required": "Merchant Address is required.",
    }),
    storeName: joi.string().trim().required().messages({
      "string.empty": "Store Name is required.",
      "any.required": "Store Name is required.",
    }),
    merchantcity_id: joi.string().trim().required().messages({
      "string.empty": "Merchant City ID is required.",
      "any.required": "Merchant City ID is required.",
    }),
    merchantzone_id: joi.string().trim().required().messages({
      "string.empty": "Merchant Zone ID is required.",
      "any.required": "Merchant Zone ID is required.",
    }),
    merchantarea_id: joi.string().trim().required().messages({
      "string.empty": "Merchant Area ID is required.",
      "any.required": "Merchant Area ID is required.",
    }),
    password: joi.string().trim().messages({
      "string.empty": "Password is required.",
      "any.required": "Password is required.",
    }),
  },
  { abortEarly: true, allowUnknown: true }
);

exports.validateMerchant = async (req) => {
  try {
    const value = await merchantSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log("Validation error " + error.details.map((err) => err.message));
    throw new customError(
      "Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};
