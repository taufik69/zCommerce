const express = require("express");
const _ = express.Router();
const discountBannerController = require("../../controller/discountBanner.controller");
const { singleFileUpload } = require("../../middleware/multer.middleware");

// Create banner
_.route("/create-discountbanner").post(
  singleFileUpload("image"),
  discountBannerController.createDiscountBanner
);
_.route("/update-discountbanner/:slug").put(
  singleFileUpload("image"),
  discountBannerController.updateDiscountBanner
);

_.route("/all-discountbanner").get(
  discountBannerController.getAllDiscountBanner
);
_.route("/single-discountbanner/:slug").get(
  discountBannerController.getSingleDiscountBanner
);
_.route("/delete-discountbanner/:slug").delete(
  discountBannerController.deleteDiscountBanner
);

module.exports = _;
