const express = require("express");
const { customError } = require("../lib/CustomError");
const categoryRoutes = require("./api/category.api");
const subcategoryRoutes = require("./api/subCategory.api");
const brandRoutes = require("./api/brand.api");
const productRoutes = require("./api/product.api");
const variantRoutes = require("./api/variant.api");
const discountRoutes = require("./api/discount.api");
const productInventoryRoutes = require("./api/productInventory.api");
const roleBaseAuthRoutes = require("./api/roleBaseAuth/auth.api");
const _ = express.Router();

// user role and persmission
_.use("/admin", roleBaseAuthRoutes);

_.use(categoryRoutes);
_.use(subcategoryRoutes);
_.use(brandRoutes);
_.use("/product", productRoutes);
_.use(variantRoutes);
_.use(discountRoutes);
_.use("/product-inventory", productInventoryRoutes);
_.route("*").all(() => {
  throw new customError("Route not found", 404);
});
module.exports = _;
