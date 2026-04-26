const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const categorySchema = joi
  .object({
    name: joi.string().trim().min(2).max(100).required().messages({
      "string.empty": "Name is required.",
      "string.min": "Name must be at least 2 characters.",
      "string.max": "Name must be at most 100 characters.",
      "any.required": "Name is required.",
    }),
  })
  .options({ abortEarly: false, allowUnknown: true });

/**
 * Validates category create request.
 * Throws customError on failure — caller is inside asynchandeler so no need
 * to call next() here; just throw and let the global handler respond.
 */
const validateCategory = async (req) => {
  // Joi validation — throws ValidationError on failure
  const value = await categorySchema.validateAsync(req.body);

  if (!req.files || req.files.length === 0) {
    throw new customError(
      "Please provide a category image",
      statusCodes.BAD_REQUEST,
    );
  }

  if (req.files.length > 1) {
    throw new customError(
      "Only 1 image is allowed per category",
      statusCodes.BAD_REQUEST,
    );
  }

  const file = req.files[0];

  if (file.fieldname !== "image") {
    throw new customError(
      'Image field name must be "image"',
      statusCodes.BAD_REQUEST,
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new customError(
      "Image size must be less than 5 MB",
      statusCodes.BAD_REQUEST,
    );
  }

  return { name: value.name, image: file };
};

module.exports = { validateCategory };
