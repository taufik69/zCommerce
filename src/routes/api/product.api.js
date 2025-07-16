const express = require("express");
const _ = express.Router();
const Product = require("../../controller/product.controller");
const {
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
_.route("/createproduct").post(
  // authGuard,
  // authorize("product", "add"),
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.createProduct
);

_.route("/getproduct").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getAllProducts
);

_.route("/getproduct/:slug").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getProductBySlug
);
_.route("/updateproductinfo/:slug").put(
  // authGuard,
  // authorize("product", "edit"),
  Product.updateProductInfoBySlug
);
_.route("/addproductimage/:slug").post(
  // authGuard,
  // authorize("product", "edit"),
  multipleFileUploadWithFields([{ name: "image", maxCount: 10 }]),
  Product.addProductImage
);

_.route("/deleteproductimage/:slug").delete(
  // authGuard,
  // authorize("product", "edit"),
  Product.deleteProductImage
);

_.route("/productperpage").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getProductsWithPagination
);
_.route("/deleteproduct/:slug").delete(
  // authGuard,
  // authorize("product", "delete"),
  Product.deleteProductBySlug
);
module.exports = _;
