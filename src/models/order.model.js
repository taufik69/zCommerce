const mongoose = require("mongoose");
const Product = require("./product.model");
const { required } = require("joi");

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
      // {
      //   productId: {
      //     type: mongoose.Schema.Types.ObjectId,
      //     ref: "Product",
      //     required: true,
      //   },
      //   name: String,
      //   quantity: Number,
      //   totalPrice: Number,
      //   retailPrice: Number,
      //   size: String,
      //   color: String,
      // },
    ],

    // SHIPPING INFO
    shippingInfo: {
      fullName: { type: String, required: false },
      phone: { type: String },
      address: { type: String, required: false },
      email: { type: String },
      city: {
        city_id: { type: Number },
        city_name: { type: String },
      },
      zone: {
        zone_id: { type: Number },
        zone_name: { type: String },
      },
      area: {
        area_id: { type: Number },
        area_name: { type: String },
      },

      country: {
        type: String,
        default: "Bangladesh",
      },
      deliveryZone: {
        type: String,
        enum: ["inside_dhaka", "outside_dhaka", "sub_area"],
      },
    },

    productWeight: { type: Number, default: 0 }, // in grams
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
      enum: ["Pending", "success", "failed", "cancelled"],
      default: "Pending",
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
      enum: [
        "Pending",
        "Hold",
        "Confirmed",
        "Packaging",
        "Courier",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    // INVOICE ID (Optional)
    invoiceId: {
      type: String,
      default: null,
    },
    // COURIER
    courier: {
      name: {
        type: String,

        default: null,
      },
      trackingId: { type: String, default: null },
      rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
      status: {
        type: String,

        default: "pending",
      },
    },
    orderType: {
      type: String,
      default: "complete", // complete or partial
    },
    followUp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isAutoPlaced: {
      type: Boolean,
      default: false,
    },
    totalQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
