const joi = require("joi");
const { customError } = require("../lib/CustomError");

const productSchema = joi
  .object({
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),

    description: joi.string().trim().required().messages({
      "string.empty": "Description is required.",
      "any.required": "Description is required.",
    }),
    category: joi.string().trim().required().messages({
      "string.empty": "Category is required.",
      "any.required": "Category is required.",
    }),
    subcategory: joi.string().trim().required().messages({
      "string.empty": "Subcategory is required.",
      "any.required": "Subcategory is required.",
    }),
    brand: joi.string().trim().required().messages({
      "string.empty": "Brand is required.",
      "any.required": "Brand is required.",
    }),
    discountId: joi.string().trim().optional(),
    tag: joi.array().items(joi.string()).optional(),
  })
  .options({ abortEarly: false }); // Validate all fields, not just the first error

const validateProduct = async (req) => {
  try {
    const value = await productSchema.validateAsync(req.body);
    //   now manually check req.file and req.files
    if (!req.files) {
      throw new customError("Please provide at least one image", 400);
    }

    if (
      req.files.image[0].fieldname !== "image" ||
      req.files.thumbnail[0].fieldname !== "thumbnail"
    ) {
      throw new customError(
        "Please provide a valid image name fieldName (image || thumbnail)",
        400
      );
    }

    if (req.files.thumbnail.length > 1) {
      throw new customError("You can upload a maximum of 1 images", 400);
    }
    if (req.files.image.length > 15) {
      throw new customError("You can upload a maximum of 15 images", 400);
    }
    return value;
  } catch (error) {
    console.log(
      "product Validation error " + error.details.map((err) => err.message)
    );
    throw new customError(
      "product Validation error " + error.details.map((err) => err.message),
      400
    );
  }
};

module.exports = { validateProduct };
