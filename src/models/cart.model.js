const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  guestId: {
    type: String,
    default: null, // for guest user
  },

  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
      totalPrice: {
        type: Number,
        required: true,
        default: 0,
      },
      price: {
        type: Number,
        required: true,
        default: 0,
      },
      reatailPrice: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  ],
  color: {
    type: String,
  },
  size: {
    type: String,
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
  },
  discountPrice: {
    type: Number,
    default: 0,
  },
  discountPercentance: {
    type: Number,
    default: 0,
  },
  totalAmountOfWholeProduct: {
    type: Number,
    required: true,
    default: 0,
  },
});

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
