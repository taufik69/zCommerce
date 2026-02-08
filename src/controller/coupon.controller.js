const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateCoupon } = require("../validation/coupon.validation");
const { statusCodes } = require("../constant/constant");

// Create coupon
exports.createCoupon = asynchandeler(async (req, res, next) => {
  const value = await validateCoupon(req, res, next);
  const coupon = new Coupon(value);
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);
  await coupon.save();
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Coupon created successfully",
    coupon,
  );
});

// Search coupon using slug
exports.searchCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug)
    throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const coupon = await Coupon.findOne({ slug: req.params.slug });
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon found", coupon);
});

// Update coupon
exports.updateCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug)
    throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const coupon = await Coupon.findOneAndUpdate(
    { slug: req.params.slug },
    req.body,
    { new: true },
  );

  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon updated", coupon);
});

// Delete coupon
exports.deleteCoupon = asynchandeler(async (req, res) => {
  if (!req.params.slug)
    throw new customError("Slug not provided", statusCodes.BAD_REQUEST);

  const coupon = await Coupon.findOneAndDelete({ slug: req.params.slug });
  if (!coupon) throw new customError("Coupon not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(res, statusCodes.OK, "Coupon deleted", coupon);
});

// Get all coupons
exports.getAllCoupons = asynchandeler(async (req, res) => {
  const coupons = await Coupon.find();
  if (!coupons || coupons.length === 0)
    throw new customError("No coupons found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Coupons fetched successfully",
    coupons,
  );
});
