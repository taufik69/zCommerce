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
module.exports = _;
