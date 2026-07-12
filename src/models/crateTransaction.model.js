const mongoose = require("mongoose");
const Counter = require("./counter.model");

const crateTransactionSchema = new mongoose.Schema(
  {
    // Sequential, never-reused display serial — e.g. TRXID-SI-01
    transactionSerialId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

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

// Auto-generate a sequential, never-reused transactionSerialId after first save
crateTransactionSchema.post("save", async function (doc, next) {
  try {
    if (doc.transactionSerialId) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "TRANSACTION_SERIAL" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.transactionSerialId = `TRXID-SI-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { transactionSerialId: doc.transactionSerialId } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.CrateTransaction ||
  mongoose.model("CrateTransaction", crateTransactionSchema);
