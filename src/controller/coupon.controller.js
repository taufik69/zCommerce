const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const {customError} = require("../lib/CustomError");
const {asynchandeler} = require("../lib/asyncHandeler");
const {validateCoupon} = require("../validation/coupon.validation");

// Create coupon
exports.createCoupon = asynchandeler(async (req, res) => {
  const value = await validateCoupon(req);
  const coupon = new Coupon(value);
  await coupon.save();
  apiResponse.sendSuccess(res, 201, "Coupon created successfully", coupon);
});

// Search coupon using slug
exports.searchCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug) throw new customError("Slug not provided", 400);

  const coupon = await Coupon.findOne({ slug: req.params.slug });
  if (!coupon) throw new customError("Coupon not found", 404);

  apiResponse.sendSuccess(res, 200, "Coupon found", coupon);
});

// Update coupon
exports.updateCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug) throw new customError("Slug not provided", 400);

  const coupon = await Coupon.findOneAndUpdate(
    { slug: req.params.slug },
    req.body,
    { new: true }
  );

  if (!coupon) throw new customError("Coupon not found", 404);

  apiResponse.sendSuccess(res, 200, "Coupon updated", coupon);
});

// Delete coupon
exports.deleteCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug) throw new customError("Slug not provided", 400);

  const coupon = await Coupon.findOneAndDelete({ slug: req.params.slug });
  if (!coupon) throw new customError("Coupon not found", 404);

  apiResponse.sendSuccess(res, 200, "Coupon deleted", coupon);
});

// Get all coupons
exports.getAllCoupons = asynchandeler(async (req, res) => {
  const coupons = await Coupon.find();
  if (!coupons?.length) throw new customError("No coupons found", 404);

  apiResponse.sendSuccess(res, 200, "Coupons fetched successfully", coupons);
});
