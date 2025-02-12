const express = require("express");
const _ = express.Router();
const { customError } = require("../../lib/CustomError");

_.route("/auth").post(async (req, res) => {
  try {
    res.status(200).json({
      status: "success",
      message: "Login successfull",
      data: null,
    });
  } catch (error) {
    throw new customError(error.message, 500);
  }
});

module.exports = _;
