const express = require("express");
const _ = express.Router();
const Brand = require("../../controller/brand.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
_.route("/brand")
  .post(
    // authGuard,
    // authorize("brand", "add"),
    multipleFileUpload("image", 1),
    Brand.createBrand,
  )
  .get(Brand.getAllBrands);
_.route("/brand/search").get(Brand.searchBrand);
_.route("/brand/:slug")
  .get(
    // authGuard, authorize("brand", "view"),
    Brand.getBrandBySlug,
  )
  .put(
    // authGuard,
    // authorize("brand", "edit"),
    multipleFileUpload("image", 1),
    Brand.updateBrand,
  )
  .delete(
    // authGuard,
    // authorize("brand", "delete"),
    Brand.deleteBrand,
  );
_.route("/brand/:slug/activate").put(
  // authGuard,
  // authorize("brand", "edit"),
  Brand.activateBrand,
);
_.route("/brand/:slug/deactivate").put(
  // authGuard,
  // authorize("brand", "edit"),
  Brand.deactivateBrand,
);

module.exports = _;
