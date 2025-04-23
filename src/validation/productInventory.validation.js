const joi = require("joi");
const { customError } = require("../lib/CustomError");

const productInventorySchema = joi
  .object({
    productId: joi.string().required().messages({
      "string.empty": "Product Id is required.",
      "any.required": "Product Id is required.",
    }),
    variant: joi.string().required().messages({
      "string.empty": "Variant is required.",
      "any.required": "Variant is required.",
    }),
    discount: joi.string().optional().allow(null).messages({
      "string.base": "Discount must be a valid ID",
    }),
    stock: joi.number().required().min(0).messages({
      "number.base": "Stock must be a number",
      "number.min": "Stock cannot be less than 0",
      "any.required": "Stock is required",
    }),
    reverseStock: joi.number().default(0).min(0).messages({
      "number.base": "Reverse Stock must be a number",
      "number.min": "Reverse Stock cannot be less than 0",
    }),
    instock: joi.boolean().default(true).messages({
      "boolean.base": "In stock must be a boolean value",
    }),
    warehouseLocation: joi.string().trim().optional().messages({
      "string.base": "Warehouse location must be a valid string",
    }),
    sellingPrice: joi.number().required().min(0).messages({
      "number.base": "Selling price must be a number",
      "number.min": "Selling price cannot be less than 0",
      "any.required": "Selling price is required",
    }),
    wholeSalePrice: joi.number().required().min(0).messages({
      "number.base": "Whole sale price must be a number",
      "number.min": "Whole sale price cannot be less than 0",
      "any.required": "Whole sale price is required",
    }),
    profitRate: joi.number().required().min(0).messages({
      "number.base": "Profit rate must be a number",
      "number.min": "Profit rate cannot be less than 0",
      "any.required": "Profit rate is required",
    }),
  })
  .options({ abortEarly: false }); // Validate all fields, not just the first error

module.exports = { validateProductInventory };

async function validateProductInventory(req) {
  try {
    const value = await productInventorySchema.validateAsync(req.body);
    return value;
  } catch (error) {
    throw new customError(
      "Product inventory validation error: " +
        error.details.map((err) => err.message).join(", "), // Use `error.details`
      400
    );
  }
}
