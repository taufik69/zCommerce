const express = require("express");
const _ = express.Router();
const couponController = require("../../controller/coupon.controller");

// ── CRUD ──────────────────────────────────────────────────────────────────────
_.post("/create",                    couponController.createCoupon);
_.get("/getallcoupon",               couponController.getAllCoupons);
_.put("/update-coupon/:slug",        couponController.updateCoupon);
_.delete("/delete-coupon/:slug",     couponController.deleteCoupon);

// ── Search by name (code) — GET /coupon/search?name=SAVE ─────────────────────
_.get("/search",                     couponController.searchCoupon);

// ── Active / Deactive toggle ──────────────────────────────────────────────────
_.put("/:slug/activate",             couponController.activateCoupon);
_.put("/:slug/deactivate",           couponController.deactivateCoupon);

// ── Validity check ────────────────────────────────────────────────────────────
_.get("/check-validity",             couponController.checkCouponValidity);

module.exports = _;

