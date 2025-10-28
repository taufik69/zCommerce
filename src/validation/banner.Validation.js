const joi = require("joi");
const { customError } = require("../lib/CustomError");

const bannerSchema = joi.object({
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
});

exports.validateBanner = async (req) => {
  try {
    // 🔹 Joi validation
    const value = await bannerSchema.validateAsync(req.body, {
      abortEarly: false, // show all validation errors
    });

    if (req.file) {
      // 🔹 Validate single image (req.file)
      if (!req.file) {
        throw new customError("Please provide a banner image", 400);
      }

      // 🔹 Validate fieldname
      if (req.file.fieldname !== "image") {
        throw new customError(
          "Please provide a valid image field name (image)",
          400
        );
      }

      // 🔹 Validate image size (limit 15MB)
      if (req.file.size > 15 * 1024 * 1024) {
        throw new customError("Image size should be less than 15MB", 400);
      }
    }

    return { ...value, image: req.file || null };
  } catch (error) {
    if (error.details) {
      // Joi error
      const message = error.details.map((err) => err.message).join(", ");
      throw new customError("Validation error: " + message, 400);
    }
    throw new customError(error.message || "Validation failed", 400);
  }
};
