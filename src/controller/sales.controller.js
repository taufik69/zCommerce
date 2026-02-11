const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const mongoose = require("mongoose");
const salesModel = require("../models/sales.model");
const { statusCodes } = require("../constant/constant");

// @desc create a new sales
exports.createSales = asynchandeler(async (req, res, next) => {
  const sales = await salesModel.create(req.body);
  if (!sales) throw new customError("Sales not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Sales created successfully",
    sales,
  );
});
