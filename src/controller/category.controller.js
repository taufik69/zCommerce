const { apiResponse } = require("../utils/apiResponse");
const Category = require("../models/category.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCategory } = require("../validation/category.validation");

exports.createCategory = asynchandeler(async (req, res) => {
  const value = validateCategory(req);
  console.log("validation value", value);
  const { name } = value;

 

  //   throw new customError("Please provide all required fields", 400);

  //   apiResponse.sendSuccess(res, 201, "Category created successfully", {
  //     category: {
  //       name: req.body.name,
  //       slug: req.body.slug,
  //       image: req.body.image,
  //       isActive: req.body.isActive,
  //     },
  //   });
});
