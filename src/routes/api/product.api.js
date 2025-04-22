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
_.route("/getsingleproduct/:slug").get(Product.getSingleProduct);
_.route("/updateproduct/:slug").put(Product.updateProductInfo);
_.route("/updateproduct/:slug/image").put(
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.updateProductImages
);
// req.query apply
_.route("/getproductspagination").get(Product.getProductsPagination);

module.exports = _;
