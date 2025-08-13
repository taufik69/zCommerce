const mongoose = require("mongoose");
const Product = require("./product.model");

const orderSchema = new mongoose.Schema(
  {
    // USER INFO (Registered or Guest)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestId: {
      type: String, // For guest users tracking
      default: null,
    },

    // ORDER ITEMS SNAPSHOT
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        quantity: Number,
        totalPrice: Number,
        retailPrice: Number,
        size: String,
        color: String,
      },
    ],

    // SHIPPING INFO
    shippingInfo: {
      fullName: { type: String, required: true },
      phone: { type: String },
      address: { type: String, required: true },
      email: { type: String },
      state: { type: String },
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

    // DELIVERY CHARGE
    deliveryCharge: {
      type: mongoose.Types.ObjectId,
      ref: "Delivery",
    },

    // COUPON / DISCOUNT
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    totalAmount: {
      type: Number, // subtotal + deliveryCharge - discount
      required: true,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    // FINAL AMOUNTS
    finalAmount: {
      type: Number, // total of items before delivery or discount
      required: true,
    },
    // PAYMENT INFO
    paymentMethod: {
      type: String,
      enum: ["cod", "sslcommerz"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "unpaid"],
      default: "unpaid",
    },

    // SSLCommerz Payment Gateway Specific
    transactionId: {
      type: String, // sslcommerz transaction_id
      default: null,
    },
    valId: {
      type: String, // sslcommerz val_id used to verify
      default: null,
    },
    currency: {
      type: String,
      default: "BDT",
    },
    paymentGatewayData: {
      type: mongoose.Schema.Types.Mixed, // store full SSLCommerz response if needed
      default: {},
    },

    // ORDER STATUS
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    // INVOICE ID (Optional)
    invoiceId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
