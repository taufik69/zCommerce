const express = require("express");
const _ = express.Router();
const Product = require("../../controller/product.controller");
const {
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
_.route("/createproduct").post(
  authGuard,
  authorize("product", "add"),

  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.ProductCreate
);

_.route("/getallproducts").get(Product.getAllProducts);
_.route("/getsingleproduct/:slug").get(Product.getSingleProduct);
_.route("/updateproduct/:slug").put(
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.updateProductInfo
);
_.route("/updateproduct/:slug/image").put(
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.updateProductImages
);
// req.query apply
_.route("/getproductspagination").get(Product.getProductsPagination);
_.route("/productListbyOrder").get(Product.getAllProductsInOrder);
_.route("/searchProduct").get(Product.searchProductByName);

module.exports = _;
