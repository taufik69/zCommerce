const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateProductInventory,
} = require("../validation/productInventory.validation");
const ProductInventory = require("../models/productInventory.model");

exports.createProductInventory = asynchandeler(async (req, res) => {
  // Validate the request body
  const validatedData = await validateProductInventory(req);
  // Create a new product inventory record
  const productInventory = new ProductInventory(validatedData);
  await productInventory.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    201,
    "Product inventory created successfully",
    productInventory
  );
});
