const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // User (registered or guest)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // guest users will have null
    },
    guestId: {
      type: String,
      default: null,
    },

    // Order Items Snapshot
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productTitle: String,
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        totalPrice: {
          type: Number, // quantity * unitPrice
          required: true,
        },
      },
    ],

    // Shipping Info
    shippingInfo: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String },
      postalCode: { type: String },
      country: {
        type: String,
        default: "Bangladesh",
      },
      deliveryZone: {
        type: String,
        enum: ["inside_dhaka", "outside_dhaka", "sub_area"],
        required: true,
      },
    },

    // Delivery Charge
    deliveryCharge: {
      type: Number,
      required: true,
    },

    // Coupon/Discount
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },

    // Amounts
    subtotal: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number, // subtotal + deliveryCharge - discount
      required: true,
    },

    // Payment
    paymentMethod: {
      type: String,
      enum: ["cod", "sslcommerz"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    // Order Status
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    // Optional Invoice
    invoiceId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
