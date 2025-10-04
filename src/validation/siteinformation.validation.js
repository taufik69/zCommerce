const joi = require("joi");
const { customError } = require("../lib/CustomError");

// Joi Schema for site info
const siteInformationSchema = joi
  .object({
    storeName: joi.string().trim().required().messages({
      "string.empty": "Store name is required.",
      "any.required": "Store name is required.",
    }),
    propiterSlogan: joi.string().trim().optional().messages({
      "string.base": "Propiter slogan must be a string.",
    }),
    adress: joi.string().trim().required().messages({
      "string.empty": "Address is required.",
      "any.required": "Address is required.",
    }),
    phone: joi.string().trim().required().messages({
      "string.empty": "Phone number is required.",
      "any.required": "Phone number is required.",
    }),
    email: joi.string().email().trim().optional().messages({
      "string.email": "Please provide a valid email address.",
    }),
    businessHours: joi.string().trim().optional().messages({
      "string.base": "Business hours must be a valid string.",
    }),
    footer: joi.string().trim().optional().messages({
      "string.base": "Footer must be a valid string.",
    }),
    facebookLink: joi.string().uri().trim().optional().messages({
      "string.uri": "Facebook link must be a valid URL.",
    }),
    youtubeLink: joi.string().uri().trim().optional().messages({
      "string.uri": "YouTube link must be a valid URL.",
    }),
    instagramLink: joi.string().uri().trim().optional().messages({
      "string.uri": "Instagram link must be a valid URL.",
    }),
  })
  .options({ abortEarly: false });

// Middleware validation function
async function validateSiteInformation(req) {
  try {
    // Joi validation for text fields
    const value = await siteInformationSchema.validateAsync(req.body);

    // ✅ Image validation
    const file = req.file;
    if (!file) {
      throw new customError("Please provide a logo image", 400);
    }

    // Check image size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new customError("Image size must be less than 2MB", 400);
    }

    // Check image type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new customError(
        "Only JPEG, PNG, or WEBP image formats are allowed",
        400
      );
    }

    return { ...value, image: file };
  } catch (error) {
    if (error.isJoi) {
      throw new customError(
        "Site Information validation error: " +
          error.details.map((err) => err.message).join(", "),
        400
      );
    }
    throw error;
  }
}

module.exports = { validateSiteInformation };
