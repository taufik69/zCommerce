const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
// Joi Schema for site info
const siteInformationSchema = joi
  .object({
    storeName: joi.string().trim().required().messages({
      "string.empty": "Store name is required.",
      "any.required": "Store name is required.",
    }),

    propiterSlogan: joi.string().trim().allow("").optional(),

    adress: joi.string().trim().required().messages({
      "string.empty": "Address is required.",
      "any.required": "Address is required.",
    }),

    phone: joi.string().trim().required().messages({
      "string.empty": "Phone number is required.",
      "any.required": "Phone number is required.",
    }),

    email: joi.string().email().trim().allow("").optional().messages({
      "string.email": "Please provide a valid email address.",
    }),

    businessHours: joi.string().trim().allow("").optional(),
    footer: joi.string().trim().allow("").optional(),

    // facebookLink: joi.string().uri().trim().allow("").optional(),
    // youtubeLink: joi.string().uri().trim().allow("").optional(),
    // instagramLink: joi.string().uri().trim().allow("").optional(),
    // whatsappLink: joi.string().uri().trim().allow("").optional(),
    // twitterLink: joi.string().uri().trim().allow("").optional(),
    // messengerLink: joi.string().uri().trim().allow("").optional(),
    // linkedinLink: joi.string().uri().trim().allow("").optional(),
    // googleMapLink: joi.string().uri().trim().allow("").optional(),
    qrCode: joi.string().uri().trim().allow("").optional(),
  })
  .options({ abortEarly: false, allowUnknown: true });

// Middleware validation function
async function validateSiteInformation(req, res, next) {
  try {
    // Validate text fields
    const value = await siteInformationSchema.validateAsync(req.body);

    // Validate file
    const file = req.file;
    if (!file) {
      return next(
        new customError("Please provide a logo image", statusCodes.BAD_REQUEST),
      );
    }

    // Max size 2MB
    if (file.size > 2 * 1024 * 1024) {
      return next(
        new customError(
          "Image size must be less than 2MB",
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    // Allowed types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return next(
        new customError(
          "Only JPEG, PNG, or WEBP image formats are allowed",
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    return { ...value, image: file };
  } catch (error) {
    if (error.isJoi) {
      next(
        new customError(
          "Site Information validation error: " +
            error.details.map((err) => err.message).join(", "),
          statusCodes.BAD_REQUEST,
        ),
      );
      throw new customError(
        "Site Information validation error: " +
          error.details.map((err) => err.message).join(", "),
        400,
      );
    }
    throw error;
  }
}

module.exports = { validateSiteInformation };
