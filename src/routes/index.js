const express = require("express");
const { customError } = require("../lib/CustomError");
const _ = express.Router();
_.use("/auth", require("./User/auth.apiRoutes"));

_.route("*").all((req, res) => {
  throw new customError("Route not found", 404);
});
module.exports = _;
