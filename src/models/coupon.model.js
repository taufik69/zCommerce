const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true },
  expireAt: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  // Coupon can be applied to specific products, categories, or subcategories
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" }],
});

module.exports = mongoose.model("Coupon", couponSchema);

/**
 * const Coupon = require('../models/Coupon');

exports.createCoupon = async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.applyCoupon = async (req, res) => {
  const { code, productId, categoryId, subcategoryId, cartTotal } = req.body;
  try {
    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) return res.status(404).json({ error: 'Invalid coupon' });
    if (coupon.expireAt < new Date()) return res.status(400).json({ error: 'Coupon expired' });
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
      return res.status(400).json({ error: 'Usage limit exceeded' });

    // Check applicability
    let applicable = false;
    if (coupon.products.length && productId && coupon.products.includes(productId)) applicable = true;
    if (coupon.categories.length && categoryId && coupon.categories.includes(categoryId)) applicable = true;
    if (coupon.subcategories.length && subcategoryId && coupon.subcategories.includes(subcategoryId)) applicable = true;
    // If coupon is not restricted, allow global use
    if (!coupon.products.length && !coupon.categories.length && !coupon.subcategories.length) applicable = true;
    if (!applicable) return res.status(400).json({ error: 'Coupon not applicable for this item' });

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
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
 */

/**
 * const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

router.post('/create', couponController.createCoupon);
router.post('/apply', couponController.applyCoupon);

module.exports = router;
 */
