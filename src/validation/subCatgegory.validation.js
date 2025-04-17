const joi = require("joi");
const { customError } = require("../lib/CustomError");

const subCategorySchmea = joi
  .object({
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),
    category: joi.string().trim().required().messages({
      "string.empty": "Category is required.",
      "any.required": "Category is required.",
    }),
  })
  .options({ abortEarly: false }); // Validate all fields, not just the first error

//   now make a validateSubCategory function that will validate the subcategory

exports.validateSubCategory = (req) => {
  const { error, value } = subCategorySchmea.validate(req.body);

  if (error) {
    throw new customError(
      "SubCategory  Validation error " +
        error.details.map((err) => err.message),
      400
    );
  }
  return value;
};
