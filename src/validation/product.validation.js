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
    warrantyInformation: joi
      .string()
      .trim()
      .default("No warranty info")
      .messages({
        "string.empty": "Warranty information cannot be empty.",
        "any.required": "Warranty information is required.",
      }),
    variantType: joi
      .string()
      .valid("singleVariant", "multipleVariant")
      .required()
      .messages({
        "any.only": "Variant type must be 'singleVariant' or 'multipleVariant'",
        "any.required": "Variant type is required.",
      }),
    retailPrice: joi.number().min(0).required().messages({
      "number.base": "Retail price must be a number.",
      "number.min": "Retail price cannot be less than 0.",
      "any.required": "Retail price is required.",
    }),
  })
  .options({ abortEarly: false, allowUnknown: true }); // Allow extra fields, only validate required

const validateProduct = async (req) => {
  try {
    const value = await productSchema.validateAsync(req.body);

    // Manual image validation (if needed)
    if (!req.files) {
      throw new customError("Please provide at least one image", 400);
    }
    if (
      !req.files.image ||
      !req.files.thumbnail ||
      req.files.image[0].fieldname !== "image" ||
      req.files.thumbnail[0].fieldname !== "thumbnail"
    ) {
      throw new customError(
        "Please provide both image and thumbnail files",
        400
      );
    }
    if (req.files.image.length === 0 || req.files.thumbnail.length === 0) {
      throw new customError("Image and thumbnail cannot be empty", 400);
    }
    if (req.files.image.length > 10) {
      throw new customError("You can upload a maximum of 10 images", 400);
    }
    if (req.files.thumbnail.length > 1) {
      throw new customError("You can upload only one thumbnail", 400);
    }

    return value;
  } catch (error) {
    console.log(
      "Product Validation error: " +
        error.details.map((err) => err.message).join(", ")
    );
    throw new customError(
      "Product Validation error: " +
        error.details.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = { validateProduct };
