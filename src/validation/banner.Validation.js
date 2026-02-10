const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const bannerSchema = joi.object(
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

exports.validateBanner = async (req, res, next) => {
  try {
    const value = await bannerSchema.validateAsync(req.body, {
      abortEarly: false, // show all validation errors
      allowUnknown: true,
    });

    if (req.file) {
      if (!req.file) {
        return next(
          new customError(
            "Please provide a banner image",
            statusCodes.BAD_REQUEST,
          ),
        );
      }
      if (req.file.fieldname !== "image") {
        next(
          new customError(
            "Please provide a valid image field name (image)",
            statusCodes.BAD_REQUEST,
          ),
        );
      }

      //Validate image size (limit 10MB)
      if (req.file.size > 5 * 1024 * 1024) {
        return next(
          new customError(
            "Image size should be less than 5MB",
            statusCodes.BAD_REQUEST,
          ),
        );
      }
    }

    return { ...value, image: req.file || null };
  } catch (error) {
    if (error.details) {
      // Joi error
      const message = error?.details?.map((err) => err.message).join(", ");
      return next(
        new customError(
          "Validation error: " + message,
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    return next(
      new customError(
        error.message || "Validation failed",
        statusCodes.BAD_REQUEST,
      ),
    );
  }
};
