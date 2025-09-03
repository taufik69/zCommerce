const express = require("express");
const _ = express.Router();
const salesReturnController = require("../../controller/salesReturn.controller");

_.route("/createsalesreturn").post(salesReturnController.createSalesReturn);

module.exports = _;
