const express = require("express");
const _ = express.Router();
const Product = require("../../controller/product.controller");
const {
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
_.route("/createproduct").post(
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.ProductCreate
);

_.route("/getallproducts").get(Product.getAllProducts);
_.route("/getproduct/:slug").get(Product.getSingleProduct);

module.exports = _;
