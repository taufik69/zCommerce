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

// check transactionCategory existence before save
crateTransactionSchema.pre("save", async function (next) {
  const tranasactionCategoryModel = require("./transactionCategory.model");
  const category = await tranasactionCategoryModel.findById(
    this.transactionCategory
  );
  if (!category) {
    throw new Error("Invalid transaction category");
  }
  next();
});

module.exports =
  mongoose.models.CrateTransaction ||
  mongoose.model("CrateTransaction", crateTransactionSchema);
