const joi = require("joi");
const { customError } = require("../lib/CustomError");
const brandSchema = joi.object({
  name: joi.string().trim().required().messages({
    "string.empty": "Name is required.",
    "any.required": "Name is required.",
  }),
});

exports.validateBrand = async (req) => {
  try {
    const value = await brandSchema.validateAsync(req.body);
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
      throw new customError("You can upload a maximum of 5 images", 400);
    }
    return { ...value, image: req.files[0] };
  } catch (error) {
    console.log("Validation error " + error.details.map((err) => err.message));
    throw new customError(
      "Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};
