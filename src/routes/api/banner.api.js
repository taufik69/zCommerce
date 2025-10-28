const express = require("express");
const _ = express.Router();
const bannerController = require("../../controller/banner.controller");
const { singleFileUpload } = require("../../middleware/multer.middleware");

// Create banner
_.route("/create-banner").post(
  singleFileUpload("image"),
  bannerController.createBanner
);
_.route("/update-banner/:slug").put(
  singleFileUpload("image"),
  bannerController.updateBanner
);

_.route("/all-banner").get(bannerController.getAllBanner);
_.route("/single-banner/:slug").get(bannerController.getSingleBanner);
_.route("/delete-banner/:slug").delete(bannerController.deleteBanner);

module.exports = _;
