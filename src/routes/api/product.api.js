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
    { name: "ogImage", maxCount: 1 },
  ]),
  Product.createProduct
);

_.route("/getproduct").get(Product.getAllProducts);

_.route("/getproduct/:slug").get(Product.getProductBySlug);

_.route("/updateproductinfo/:slug").put(
  authGuard,
  authorize("product", "edit"),
  multipleFileUploadWithFields([
    { name: "thumbnail", maxCount: 1 },
    { name: "ogImage", maxCount: 1 },
  ]),
  Product.updateProductInfoBySlug
);

_.route("/product-status/:slug").put(
  authGuard,
  authorize("product", "edit"),
  Product.updateProductStatus
);

_.route("/addproductimage/:slug").post(
  authGuard,
  authorize("product", "edit"),
  multipleFileUploadWithFields([{ name: "image", maxCount: 10 }]),
  Product.addProductImage
);

_.route("/deleteproductimage/:slug").delete(
  authGuard,
  authorize("product", "edit"),
  Product.deleteProductImage
);

_.route("/productperpage").get(
  authGuard,
  authorize("product", "view"),
  Product.getProductsWithPagination
);

_.route("/deleteproduct/:slug").delete(
  authGuard,
  authorize("product", "delete"),
  Product.deleteProductBySlug
);

_.route("/multiplevarinatproduct").get(
  authGuard,
  authorize("product", "view"),
  Product.getAllMultipleVariantProducts
);

_.route("/all-single-variant-products").get(
  authGuard,
  authorize("product", "view"),
  Product.getAllSingleVariantProducts
);

_.route("/newarrival").get(Product.getNewArrivalProducts);

_.route("/price-range").get(Product.getProductsByPriceRange);

_.route("/related-products").post(Product.getRelatedProducts);

_.route("/discount-products").get(Product.getDiscountProducts);

_.route("/best-selling-products").get(Product.getBestSellingProducts);

_.route("/search-product").get(Product.getNameWiseSearch);

module.exports = _;
