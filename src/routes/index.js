const express = require("express");
const { customError } = require("../lib/CustomError");
const categoryRoutes = require("./api/category.api");
const _ = express.Router();

_.use(categoryRoutes);
_.route("*").all(() => {
  throw new customError("Route not found", 404);
});
module.exports = _;
