const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

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
    secondaryPhone: joi.string().trim().allow("").optional(),
    email: joi.string().email().trim().allow("").optional().messages({
      "string.email": "Please provide a valid email address.",
    }),
    businessHours: joi.string().trim().allow("").optional(),
    businessType: joi.string().trim().allow("").optional(),
    ownerName: joi.string().trim().allow("").optional(),
    websiteLink: joi.string().trim().allow("").optional(),
    footer: joi.string().trim().allow("").optional(),
    facebookLink: joi.string().trim().allow("").optional(),
    youtubeLink: joi.string().trim().allow("").optional(),
    instagramLink: joi.string().trim().allow("").optional(),
    whatsappLink: joi.string().trim().allow("").optional(),
    twitterLink: joi.string().trim().allow("").optional(),
    messengerLink: joi.string().trim().allow("").optional(),
    linkedinLink: joi.string().trim().allow("").optional(),
    googleMapLink: joi.string().trim().allow("").optional(),
    qrCode: joi.string().trim().allow("").optional(),
  })
  .options({ abortEarly: false, allowUnknown: true });

async function validateSiteInformation(req) {
  try {
    const value = await siteInformationSchema.validateAsync(req.body);

    const file = req.file;
    if (!file) {
      throw new customError("Please provide a logo image", statusCodes.BAD_REQUEST);
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new customError("Image size must be less than 2MB", statusCodes.BAD_REQUEST);
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new customError(
        "Only JPEG, PNG, or WEBP image formats are allowed",
        statusCodes.BAD_REQUEST,
      );
    }

    return { ...value, image: file };
  } catch (error) {
    if (error.isJoi) {
      throw new customError(
        "Site Information validation error: " +
          error.details.map((err) => err.message).join(", "),
        statusCodes.BAD_REQUEST,
      );
    }
    throw error;
  }
}

module.exports = { validateSiteInformation };
