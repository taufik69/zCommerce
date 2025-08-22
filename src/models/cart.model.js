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
      },
      variant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
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

      color: {
        type: String,
      },
      size: {
        type: String,
      },
    },
  ],
});

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
