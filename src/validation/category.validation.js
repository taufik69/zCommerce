const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Define the validation schema
const categorySchema = joi
  .object({
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),
  })
  .options({ abortEarly: false, allowUnknown: true }); // Validate all fields, not just the first error

// Middleware for validation
const validateCategory = async (req, res, next) => {
  try {
    const value = await categorySchema.validateAsync(req.body);

    if (!req.files || req.files.length === 0) {
      return next(
        new customError(
          "Please provide at least one image",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    if (req.files[0].fieldname !== "image") {
      throw new customError(
        "Please provide a valid image name fieldName (image)",
        400,
      );
    }
    if (req.files[0].size > 5 * 1024 * 1024) {
      return next(
        new customError(
          "Image size should be less than 15MB",
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    if (req.files.length > 1) {
      return next(
        new customError(
          "You can upload a maximum of 1 images",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    return { ...value, image: req.files[0] };
  } catch (error) {
    next(error);
    throw new customError("Validation error " + error, statusCodes.BAD_REQUEST);
  }
};

module.exports = { validateCategory };
