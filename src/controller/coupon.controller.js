const { customError } = require("../lib/CustomError");
const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { validateCoupon } = require("../validation/coupon.validation");
/**
 * Handles the creation of a new coupon by validating the request data,
 * saving the coupon to the database, and sending a success response.
 *
 * @param {Object} req - The request object containing coupon data.
 * @param {Object} res - The response object used to send the response.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 * @throws {Error} - Throws an error if coupon validation fails or saving to the database fails.
 */
exports.createCoupon = async (req, res) => {
  try {
    const value = await validateCoupon(req);
    const coupon = new Coupon(value);
    await coupon.save();
    apiResponse.sendSuccess(res, 201, "Coupon created successfully", coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// serarch coupon using slug
exports.searchCoupon = async (req, res) => {
  try {
    if (!req.params.slug) {
      throw new customError("Slug not provided", 400);
    }
    const coupon = await Coupon.findOne({ slug: req.params.slug });
    if (!coupon) {
      throw new customError("Coupon not found", 404);
    }
    apiResponse.sendSuccess(res, 200, "Coupon found", coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
// update coupon
exports.updateCoupon = async (req, res) => {
  try {
    if (!req.params.slug) {
      throw new customError("Slug not provided", 400);
    }
    const coupon = await Coupon.findOneAndUpdate(
      { slug: req.params.slug },
      req.body,
      { new: true }
    );
    if (!coupon) {
      throw new customError("Coupon not found", 404);
    }
    apiResponse.sendSuccess(res, 200, "Coupon updated", coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

//deleteCoupon
exports.deleteCoupon = async (req, res) => {
  try {
    if (!req.params.slug) {
      throw new customError("Slug not provided", 400);
    }
    const coupon = await Coupon.findOneAndDelete({ slug: req.params.slug });
    if (!coupon) {
      throw new customError("Coupon not found", 404);
    }
    apiResponse.sendSuccess(res, 200, "Coupon deleted", coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.applyCoupon = async (req, res) => {
  const { code, productId, categoryId, subcategoryId, cartTotal } = req.body;
  try {
    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) return res.status(404).json({ error: "Invalid coupon" });
    if (coupon.expireAt < new Date())
      return res.status(400).json({ error: "Coupon expired" });
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      return res.status(400).json({ error: "Usage limit exceeded" });

    // Check applicability
    let applicable = false;
    if (
      coupon.products.length &&
      productId &&
      coupon.products.includes(productId)
    )
      applicable = true;
    if (
      coupon.categories.length &&
      categoryId &&
      coupon.categories.includes(categoryId)
    )
      applicable = true;
    if (
      coupon.subcategories.length &&
      subcategoryId &&
      coupon.subcategories.includes(subcategoryId)
    )
      applicable = true;
    // If coupon is not restricted, allow global use
    if (
      !coupon.products.length &&
      !coupon.categories.length &&
      !coupon.subcategories.length
    )
      applicable = true;
    if (!applicable)
      return res
        .status(400)
        .json({ error: "Coupon not applicable for this item" });

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = cartTotal * (coupon.discountValue / 100);
    } else {
      discount = coupon.discountValue;
    }

    coupon.usedCount += 1;
    await coupon.save();

    res.json({ discount, total: cartTotal - discount, coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
