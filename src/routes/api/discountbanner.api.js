const express = require("express");
const _ = express.Router();
const discountBannerController = require("../../controller/discountBanner.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { singleFileUpload } = require("../../middleware/multer.middleware");

// Create banner
_.route("/create-discountbanner").post(
  authGuard,
  authorize("discount-banner", "add"),
  singleFileUpload("image"),
  discountBannerController.createDiscountBanner,
);
_.route("/update-discountbanner/:slug").put(
  authGuard,
  authorize("discount-banner", "edit"),
  singleFileUpload("image"),
  discountBannerController.updateDiscountBanner,
);

_.route("/all-discountbanner").get(
  authGuard,
  authorize("discount-banner", "view"),
  discountBannerController.getAllDiscountBanner,
);
_.route("/single-discountbanner/:slug").get(
  authGuard,
  authorize("discount-banner", "view"),
  discountBannerController.getSingleDiscountBanner,
);
_.route("/delete-discountbanner/:slug").delete(
  authGuard,
  authorize("discount-banner", "delete"),
  discountBannerController.deleteDiscountBanner,
);

module.exports = _;
