const mongoose = require("mongoose");

const moneyTransferSchema = new mongoose.Schema({
  Date: {
    type: Date,
    trim: true,
  },
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  transactionDesction: {
    type: String,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  voucherNumber: {
    type: String,
    trim: true,
  },
});

module.exports =
  mongoose.models.MoneyTransfer ||
  mongoose.model("MoneyTransfer", moneyTransferSchema);
