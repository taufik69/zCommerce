const mongoose = require("mongoose");

const crateTransactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    transactionCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransitionCategory",
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    transactionDescription: {
      type: String,
      trim: true,
    },
    voucherNumber: {
      type: String,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: ["cash recived", "cash payment"],
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CrateTransaction ||
  mongoose.model("CrateTransaction", crateTransactionSchema);
