const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const SizeChart = require("../models/sizeChart.model");
const { asynchandeler } = require("../lib/asyncHandeler");
// create size chart
exports.createSizeChart = asynchandeler(async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    throw new customError("Name is required", 400);
  }
  const image = req.fils;

  return apiResponse.sendSuccess(res, 200, "Size chart created successfully", {
    sizeChart,
  });
});
