const express = require("express");
const _ = express.Router();
const bannerController = require("../../controller/banner.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { singleFileUpload } = require("../../middleware/multer.middleware");

// Create banner
_.route("/create-banner").post(
  authGuard,
  authorize("create-banner", "add"),
  singleFileUpload("image"),
  bannerController.createBanner,
);
_.route("/update-banner/:slug").put(
  authGuard,
  authorize("create-banner", "edit"),
  singleFileUpload("image"),
  bannerController.updateBanner,
);

_.route("/all-banner").get(
  authGuard,
  authorize("create-banner", "view"),
  bannerController.getAllBanner,
);
_.route("/single-banner/:slug").get(
  authGuard,
  authorize("create-banner", "view"),
  bannerController.getSingleBanner,
);
_.route("/delete-banner/:slug").delete(
  authGuard,
  authorize("create-banner", "delete"),
  bannerController.deleteBanner,
);

module.exports = _;
