const joi = require("joi");
const { customError } = require("../lib/CustomError");

const productSchema = joi
  .object({
    name: joi.string().trim().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),
    description: joi.string().trim().messages({
      "string.empty": "Description is required.",
      "any.required": "Description is required.",
    }),
    category: joi.string().trim().messages({
      "string.empty": "Category is required.",
      "any.required": "Category is required.",
    }),
    subcategory: joi.string().trim().messages({
      "string.empty": "Subcategory is required.",
      "any.required": "Subcategory is required.",
    }),
    brand: joi.string().trim().messages({
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

    stock: joi
      .number()
      .min(0)
      .messages({
        "number.base": "Stock must be a number.",
        "number.min": "Stock cannot be negative.",
        "any.required": "Stock is required.",
      })
      .default(0),
    purchasePrice: joi.number().min(0).messages({
      "number.base": "Purchase price must be a number.",
      "number.min": "Purchase price cannot be negative.",
      "any.required": "Purchase price is required.",
    }),
    retailPrice: joi.number().min(0).messages({
      "number.base": "Retail price must be a number.",
      "number.min": "Retail price cannot be negative.",
      "any.required": "Retail price is required.",
    }),
    wholesalePrice: joi.number().min(0).messages({
      "number.base": "Wholesale price must be a number.",
      "number.min": "Wholesale price cannot be negative.",
      "any.required": "Wholesale price is required.",
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
    if (!req.files.image || req.files.image[0].fieldname !== "image") {
      throw new customError("Please provide both image files", 400);
    }
    if (req.files.image.length === 0) {
      throw new customError("Image cannot be empty", 400);
    }
    if (req.files.image.length > 10) {
      throw new customError("You can upload a maximum of 10 images", 400);
    }

    return value;
  } catch (error) {
    console.log("Product Validation error:", error);

    console.log(
      "Product Validation error: " +
        error?.details?.map((err) => err.message).join(", ")
    );
    throw new customError(
      "Product Validation error: " +
        error?.details?.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = { validateProduct };
