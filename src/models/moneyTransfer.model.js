const mongoose = require("mongoose");
const Counter = require("./counter.model");

const moneyTransferSchema = new mongoose.Schema({
  // Sequential, never-reused display serial — e.g. MTRF-SI-01
  transferSerialId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },

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
}, { timestamps: true });

// Auto-generate a sequential, never-reused transferSerialId after first save
moneyTransferSchema.post("save", async function (doc, next) {
  try {
    if (doc.transferSerialId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "MONEY_TRANSFER_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.transferSerialId = `MTRF-SI-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { transferSerialId: doc.transferSerialId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.MoneyTransfer ||
  mongoose.model("MoneyTransfer", moneyTransferSchema);
