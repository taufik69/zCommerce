const express = require("express");
const _ = express.Router();
const couponController = require("../../controller/coupon.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create").post(
  authGuard,
  authorize("coupon", "add"),
  couponController.createCoupon,
);

_.route("/getallcoupon").get(
  authGuard,
  authorize("coupon", "view"),
  couponController.getAllCoupons,
);

_.route("/check-validity").get(couponController.checkCouponValidity);

_.route("/serach-coupon/:slug").get(
  authGuard,
  authorize("coupon", "view"),
  couponController.searchCoupon,
);

_.route("/update-coupon/:slug").put(
  authGuard,
  authorize("coupon", "edit"),
  couponController.updateCoupon,
);

_.route("/delete-coupon/:slug").delete(
  authGuard,
  authorize("coupon", "delete"),
  couponController.deleteCoupon,
);

_.route("/:slug/activate").put(
  authGuard,
  authorize("coupon", "edit"),
  couponController.activateCoupon,
);

_.route("/:slug/deactivate").put(
  authGuard,
  authorize("coupon", "edit"),
  couponController.deactivateCoupon,
);

module.exports = _;
