const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
      default: null,
    },
    guestId: {
      type: String,
      sparse: true,
      default: null,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        snapshotPrice: {
          type: Number,
          required: true,
        },
        itemTotal: {
          type: Number,
          required: true,
        },
      },
    ],
    subTotal: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: totalItem (sum of all item quantities)
cartSchema.virtual("totalItem").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// TTL index on expiresAt (MongoDB automatically deletes documents when expiresAt is reached)
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ user: 1 });
cartSchema.index({ guestId: 1 });

// Pre-save hook to auto-calculate subTotal
cartSchema.pre("save", function (next) {
  this.subTotal = this.items.reduce((total, item) => total + item.itemTotal, 0);
  next();
});

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
