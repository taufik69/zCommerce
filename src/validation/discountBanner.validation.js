const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const discountBannerSchema = joi.object(
  {
    title: joi.string().trim().required().messages({
      "string.empty": "Banner title is required.",
      "any.required": "Banner title is required.",
    }),
    headLine: joi.string().trim().allow("").optional(),
    description: joi.string().trim().allow("").optional(),
    link: joi.string().uri().trim().allow("").optional().messages({
      "string.uri": "Please provide a valid link URL.",
    }),
    priority: joi.number().min(0).max(100).optional(),
    isActive: joi.boolean().optional(),
  },
  {
    abortEarly: false,
    allowUnknown: true,
  },
);

exports.validateDiscountBanner = async (req, isUpdate = false) => {
  try {
    const value = await discountBannerSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    // Image is REQUIRED for Discount Banner (unless it's an update)
    if (!req.file && !isUpdate) {
      throw new customError(
        "Banner image is required",
        statusCodes.BAD_REQUEST,
      );
    }

    if (req.file) {
      if (req.file.fieldname !== "image") {
        throw new customError(
          "Please provide a valid image field name (image)",
          statusCodes.BAD_REQUEST,
        );
      }

      // Validate image size (limit 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        throw new customError(
          "Image size should be less than 5MB",
          statusCodes.BAD_REQUEST,
        );
      }

      // Validate image format
      const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
      if (!validTypes.includes(req.file.mimetype)) {
        throw new customError(
          "Invalid image format. Only JPG, PNG, and WEBP are allowed",
          statusCodes.BAD_REQUEST,
        );
      }
    }

    return { ...value, image: req.file };
  } catch (error) {
    if (error.details) {
      const message = error.details.map((err) => err.message).join(", ");
      throw new customError(
        "Validation error: " + message,
        statusCodes.BAD_REQUEST,
      );
    }
    throw error;
  }
};
