const joi = require("joi");
const { customError } = require("../lib/CustomError");

const userSchema = joi
  .object({
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),

    email: joi
      .string()
      .trim()
      .email()
      .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com)$/)
      .required()
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Email must be a valid email address.",
        "any.required": "Email is required.",
      }),

    password: joi.string().trim().required().min(8).messages({
      "string.empty": "Password is required.",
      "string.min": "Password must be at least 8 characters long.",
      "any.required": "Password is required.",
    }),

    phone: joi
      .string()
      .pattern(/^01[0-9]{9}$/)
      .required()
      .messages({
        "string.empty": "Phone is required.",
        "any.required": "Phone is required.",
        "string.pattern.base":
          "Phone must be a valid Bangladeshi number (e.g. 01XXXXXXXXX)",
      }),
  })
  .options({
    abortEarly: true,
    allowUnknown: true, // allows extra fields in req.body
  });

const validateUser = async (req) => {
  try {
    const value = await userSchema.validateAsync(req.body);

    // ✅ Manual Image Validation (single image expected)
    if (!req.file) {
      throw new customError("Please provide a valid image", 400);
    }

    // Validate image fieldname
    if (req.file.fieldname !== "image") {
      throw new customError("Invalid image field name", 400);
    }

    // Validate image size (< 2MB)
    if (req.file.size > 2 * 1024 * 1024) {
      throw new customError("Image size should be less than 2MB", 400);
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!validTypes.includes(req.file.mimetype)) {
      throw new customError(
        "Invalid image format. Only JPG, PNG, and WEBP are allowed",
        400
      );
    }

    return { ...value, image: req.file };
  } catch (error) {
    console.log(
      "User Validation error: ",
      error?.details?.map((err) => err.message)
    );

    throw new customError(
      "User Validation error: " +
        (error.details
          ? error.details.map((err) => err.message).join(", ")
          : error.message),
      400
    );
  }
};

module.exports = { validateUser };
