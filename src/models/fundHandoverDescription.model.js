const mongoose = require("mongoose");

const fundHandoverDescriptionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      trim: true,
    },
    transactionDescription: {
      type: String,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    voucherNumber: {
      type: String,
      trim: true,
    },
    fundPaymentMode: {
      type: mongoose.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.FundHandoverDescription ||
  mongoose.model("FundHandoverDescription", fundHandoverDescriptionSchema);
