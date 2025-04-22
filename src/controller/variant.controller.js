const { apiResponse } = require("../utils/apiResponse");
const variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCategory } = require("../validation/category.validation");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const validateVariant = require("../validation/variant.validation");

exports.createVariant = asynchandeler(async (req, res, next) => {
  // Validate the request body
  const validatedData = await validateVariant(req);
  console.log(validatedData);

  return;

  // Proceed with saving the variant
  const variant = new Variant(validatedData);
  await variant.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Variant created successfully",
    variant
  );
});
