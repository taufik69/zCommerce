const express = require("express");
const _ = express.Router();
const Brand = require("../../controller/brand.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
_.route("/brand")
  .post(
    authGuard,
    authorize("brand", "add"),
    multipleFileUpload("image", 10),
    Brand.createBrand
  )
  .get(authGuard, authorize("brand", "view"), Brand.getAllBrands);

_.route("/brand/:slug")
  .get(authGuard, authorize("brand", "view"), Brand.getBrandBySlug)
  .put(
    authGuard,
    authorize("brand", "update"),
    multipleFileUpload("image", 10),
    Brand.updateBrand
  )
  .delete(authGuard, authorize("brand", "delete"), Brand.deleteBrand);

module.exports = _;
