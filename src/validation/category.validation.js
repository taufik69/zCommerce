const joi = require("joi");
const { customError } = require("../lib/CustomError");

// Define the validation schema
const categorySchema = joi
  .object({
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),
  })
  .options({ abortEarly: false }); // Validate all fields, not just the first error

// Middleware for validation
const validateCategory = async (req) => {
  try {
    const value = await categorySchema.validateAsync(req.body);
    if (!req.files || req.files.length === 0) {
      throw new customError("Please provide at least one image", 400);
    }
    if (req.files[0].fieldname !== "image") {
      throw new customError(
        "Please provide a valid image name fieldName (image)",
        400
      );
    }
    if (req.files[0].size > 5 * 1024 * 1024) {
      throw new customError("Image size should be less than 15MB", 400);
    }

    if (req.files.length > 1) {
      throw new customError("You can upload a maximum of 1 images", 400);
    }
    return { ...value, image: req.files[0] };
  } catch (error) {
    throw new customError(
      "Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};

module.exports = { validateCategory };
