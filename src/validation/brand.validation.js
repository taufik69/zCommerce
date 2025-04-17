const joi = require("joi");
const { customError } = require("../lib/CustomError");
const brandSchema = joi.object({
  name: joi.string().trim().required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
});

exports.validateBrand = (req) => {
  const { error, value } = brandSchema.validate(req.body);
  if (!req.files || req.files.length === 0) {
    throw new customError("Please provide at least one image", 400);
  }
  if (req.files[0].fieldname !== "image") {
    throw new customError(
      "Please provide a valid image name fieldName (image)",
      400
    );
  }
  if (req.files[0].size > 15 * 1024 * 1024) {
    throw new customError("Image size should be less than 15MB", 400);
  }

  if (req.files.length > 5) {
    throw new customError("You can upload a maximum of 5 images", 400);
  }

  if (error) {
    throw new customError(
      "Validation error " + error.details.map((err) => err.message),
      400
    );
  }
  return value;
};
