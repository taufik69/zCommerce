const express = require("express");
const _ = express.Router();
const variantController = require("../../controller/variant.controller");

_.route("/variant").post(variantController.createVariant);
module.exports = _;
