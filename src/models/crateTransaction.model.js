const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

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
    transactionMode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransitionCategory",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CrateTransaction", crateTransactionSchema);
