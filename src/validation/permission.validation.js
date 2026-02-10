const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const permissionSchema = Joi.object({
  permissionName: Joi.string().trim().required().messages({
    "string.empty": "Permission name is required",
    "any.required": "Permission name is required",
  }),
  actions: Joi.array()
    .items(
      Joi.string().valid("view", "add", "delete", "update").messages({
        "any.only": "Action must be one of 'view', 'add', 'delete', 'update'",
      }),
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Actions must be an array",
      "array.min": "At least one action is required",
      "any.required": "Actions are required",
    }),
}).options({ abortEarly: false, allowUnknown: true });

const validatePermission = async (req) => {
  try {
    const value = await permissionSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    throw new customError(
      "Permission Validation error: " +
        error.details.map((err) => err.message).join(", "),
      400,
    );
  }
};

module.exports = validatePermission;
