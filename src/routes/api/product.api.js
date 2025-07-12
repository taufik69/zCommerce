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
  Product.ProductCreate
);

_.route("/getallproducts").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getAllProducts
);
_.route("/getsingleproduct/:slug").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getSingleProduct
);
_.route("/updateproductinfo/:slug").put(
  // authGuard,
  // authorize("product", "update"),
  Product.updateProductInfo
);
_.route("/updateproductimages/:slug/image").put(
  // authGuard,
  // authorize("product", "update"),
  multipleFileUploadWithFields([
    { name: "image", maxCount: 10 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  Product.updateProductImages
);
// req.query apply
_.route("/getproductspagination").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getProductsPagination
);
_.route("/productListbyOrder").get(
  // authGuard,
  // authorize("product", "view"),
  Product.getAllProductsInOrder
);
_.route("/searchProduct").get(
  // authGuard,
  // authorize("product", "view"),
  Product.searchProductByName
);
_.route("/deleteproduct/:slug").delete(
  // authGuard,
  // authorize("product", "delete"),
  Product.deleteProduct
);

module.exports = _;
