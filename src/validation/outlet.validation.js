const Joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const outletInformationSchema = Joi.object({
  locationName: Joi.string().trim().required().messages({
    "string.empty": "Location name is required.",
    "any.required": "Location name is required.",
  }),
  address: Joi.string().trim().required().messages({
    "string.empty": "Address is required.",
    "any.required": "Address is required.",
  }),
  managerMobile: Joi.string().trim().required().messages({
    "string.empty": "Manager mobile is required.",
    "any.required": "Manager mobile is required.",
  }),
  managerName: Joi.string().trim().required().messages({
    "string.empty": "Manager name is required.",
    "any.required": "Manager name is required.",
  }),
  email: Joi.string().email().trim().required().messages({
    "string.empty": "Email is required.",
    "any.required": "Email is required.",
    "string.email": "Please provide a valid email address.",
  }),
  businessHour: Joi.string().trim().optional(),
  offDay: Joi.string().trim().optional(),
  isActive: Joi.boolean().optional(),
});

exports.validateOutletInformation = async (req, res, next) => {
  try {
    // Validate request body
    const value = await outletInformationSchema.validateAsync(req.body, {
      abortEarly: false, // show all errors
    });

    // 🔹 Validate image (optional, single)
    if (req.file) {
      if (req.file.fieldname !== "image") {
        return next(
          new customError(
            "Please provide a valid image field name (image)",
            statusCodes.BAD_REQUEST,
          ),
        );
      }

      if (req.file.size > 15 * 1024 * 1024) {
        return next(
          new customError(
            "Image size should be less than 15MB",
            statusCodes.BAD_REQUEST,
          ),
        );
      }
    }

    return { ...value, image: req.file || null };
  } catch (error) {
    if (error.details) {
      const message = error.details.map((err) => err.message).join(", ");
      next(new customError(message, statusCodes.BAD_REQUEST));
      throw new customError(
        "Validation error: " + message,
        statusCodes.BAD_REQUEST,
      );
    }
    next(new customError(message, statusCodes.BAD_REQUEST));
    throw new customError(
      error.message || "Validation failed",
      statusCodes.BAD_REQUEST,
    );
  }
};
