const express = require("express");
const _ = express.Router();
const Brand = require("../../controller/brand.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
_.route("/brand")
  .post(multipleFileUpload("image", 10), Brand.createBrand)
  .get(Brand.getAllBrands);

_.route("/brand/:slug")
  .get(Brand.getBrandBySlug)
  .put(multipleFileUpload("image", 10), Brand.updateBrand)
  .delete(Brand.deleteBrand);

module.exports = _;
