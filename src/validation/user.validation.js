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
  });

const validateUser = async (req) => {
  try {
    const value = await userSchema.validateAsync(req.body);

    return value;
  } catch (error) {
    console.log(
      "User Validation error " + error.details.map((err) => err.message)
    );
    throw new customError(
      "User Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};

module.exports = { validateUser };
