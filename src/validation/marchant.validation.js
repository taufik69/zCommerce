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
    webhookSecret: joi.string().trim().required().messages({
      "string.empty": "Webhook Secret is required.",
      "any.required": "Webhook Secret is required.",
    }),
    baseURL: joi.string().trim().uri().required().messages({
      "string.empty": "Base URL is required.",
      "string.uri": "Base URL must be a valid URL.",
    }),
    serviceProvider: joi.string().trim().required().messages({
      "string.empty": "Service Provider is required.",
      "any.required": "Service Provider is required.",
    }),
    store_id: joi.number().messages({
      "string.empty": "Store ID is required.",
      "any.required": "Store ID is required.",
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
