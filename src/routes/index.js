const express = require("express");
const { customError } = require("../lib/CustomError");
const categoryRoutes = require("./api/category.api");
const subcategoryRoutes = require("./api/subCategory.api");
const brandRoutes = require("./api/brand.api");
const productRoutes = require("./api/product.api");
const _ = express.Router();

_.use(categoryRoutes);
_.use(subcategoryRoutes);
_.use(brandRoutes);
_.use("/product", productRoutes);
_.route("*").all(() => {
  throw new customError("Route not found", 404);
});
module.exports = _;
