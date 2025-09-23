const express = require("express");
const _ = express.Router();
const couponController = require("../../controller/coupon.controller");

_.post("/create", couponController.createCoupon);
_.get("/serach-coupon/:slug", couponController.searchCoupon);
_.put("/update-coupon/:slug", couponController.updateCoupon);
_.delete("/delete-coupon/:slug", couponController.deleteCoupon);
_.get("/getallcoupon", couponController.getAllCoupons);

module.exports = _;
