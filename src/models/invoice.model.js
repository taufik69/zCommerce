const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define the schema for the invoice model
const invoiceSchema = new Schema(
  {
    // A unique identifier for the invoice
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    // Reference to the order this invoice belongs to
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    // Invoice details
    customerDetails: {},
    // The total amount of all products before discounts and delivery charges
    totalAmount: {
      type: Number,
      required: true,
    },
    // The amount of discount applied from a coupon
    discountAmount: {
      type: Number,
      default: 0,
    },
    // The total final amount to be paid by the customer
    finalAmount: {
      type: Number,
      required: true,
    },
    // The delivery charge amount
    deliveryChargeAmount: {
      type: Number,
      required: true,
    },
    // An optional URL to the generated PDF invoice (e.g., in cloud storage)
    invoiceUrl: {
      type: String,
    },
    // An optional URL to the payment gateway's hosted invoice page
    paymentGatewayUrl: {
      type: String,
    },
    ProductInfo: {},
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Create the Invoice model from the schema
const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

// Export the model for use in other files
module.exports = Invoice;
