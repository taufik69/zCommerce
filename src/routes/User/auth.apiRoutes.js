const express = require("express");
const _ = express.Router();
const { customError } = require("../../lib/CustomError");
const { apiResponse } = require("../../utils/apiResponse");

_.route("/signup").post(async (req, res) => {
  try {
    apiResponse.success(200, "success", {});
  } catch (error) {
    throw new customError(error.message, 500);
  }
});

module.exports = _;
