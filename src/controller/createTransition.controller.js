const { customError } = require("../lib/CustomError");
const CreateTransaction = require("../models/crateTransaction.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

// create transaction controller
exports.createTransaction = asynchandeler(async (req, res) => {
  const {
    date,
    transactionCategory,
    account,
    transactionDescription,
    voucherNumber,
    transactionType,
    amount,
  } = req.body;
  if (
    !date ||
    !transactionCategory ||
    !account ||
    !transactionDescription ||
    !transactionType ||
    !amount
  ) {
    throw new customError("All fields are required", 400);
  }

  const transaction = await CreateTransaction.create({
    date,
    transactionCategory,
    account,
    transactionDescription,
    voucherNumber,
    transactionType,
    amount,
  });
  apiResponse.sendSuccess(
    res,
    200,
    "Transaction created successfully",
    transaction
  );
});

// geta all transaction
exports.getAllTransaction = asynchandeler(async (req, res) => {
  const transactions = await CreateTransaction.find()
    .populate("account transactionCategory")
    .sort({ createdAt: -1 });

  if (!transactions.length) {
    throw new customError("Transactions not found", 404);
  }

  // ✅ Generate serial numbers dynamically
  const formattedTransactions = transactions.map((tx, index) => {
    // Convert index (0-based) to serial (1-based)
    const serial = index + 1;

    // Pad with zeros up to 6 digits → e.g., 1 → 000001
    const serialNumber = `TRXID-${serial.toString().padStart(6, "0")}`;

    return {
      ...tx.toObject(),
      serialNumber, // ✅ Add new field
    };
  });

  apiResponse.sendSuccess(
    res,
    200,
    "Transactions fetched successfully",
    formattedTransactions
  );
});

// get single transaction
exports.getSingleTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOne({ _id: id }).populate(
    "account transactionCategory"
  );
  if (!transaction) {
    throw new customError("Transaction not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Transaction fetched successfully",
    transaction
  );
});

// delete transaction
exports.deleteTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOneAndDelete({ _id: id });
  if (!transaction) {
    throw new customError("Transaction not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Transaction deleted successfully",
    transaction
  );
});

// update transaction
exports.updateTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOneAndUpdate(
    { _id: id },
    { ...req.body },
    { new: true }
  );
  if (!transaction) {
    throw new customError("Transaction not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Transaction updated successfully",
    transaction
  );
});
