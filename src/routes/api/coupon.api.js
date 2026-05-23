const express = require("express");
const _ = express.Router();
const couponController = require("../../controller/coupon.controller");

_.route("/create").post(couponController.createCoupon);
_.route("/getallcoupon").get(couponController.getAllCoupons);
_.route("/check-validity").get(couponController.checkCouponValidity);
_.route("/serach-coupon/:slug").get(couponController.searchCoupon);
_.route("/update-coupon/:slug").put(couponController.updateCoupon);
_.route("/delete-coupon/:slug").delete(couponController.deleteCoupon);
_.route("/:slug/activate").put(couponController.activateCoupon);
_.route("/:slug/deactivate").put(couponController.deactivateCoupon);

module.exports = _;
