const { customError } = require("../lib/CustomError");
const CreateTransaction = require("../models/crateTransaction.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

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
    throw new customError("All fields are required", statusCodes.BAD_REQUEST);
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
  if (!transaction) {
    throw new customError("Transaction not created", statusCodes.BAD_REQUEST);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Transaction created successfully",
    transaction,
  );
});

// geta all transaction
exports.getAllTransaction = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [rawTransactions, total] = await Promise.all([
    CreateTransaction.find()
      .populate("account transactionCategory")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CreateTransaction.countDocuments(),
  ]);

  if (!rawTransactions.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Transactions not found", {
      transactions: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transactions fetched successfully",
    { transactions: rawTransactions, total, page, limit, hasNextPage: page * limit < total },
  );
});

// get single transaction
exports.getSingleTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOne({ _id: id }).populate(
    "account transactionCategory",
  );
  if (!transaction) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction fetched successfully",
    transaction,
  );
});

// delete transaction
exports.deleteTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOneAndDelete({ _id: id });
  if (!transaction) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction deleted successfully",
    transaction,
  );
});

// update transaction
exports.updateTransaction = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const transaction = await CreateTransaction.findOneAndUpdate(
    { _id: id },
    { ...req.body },
    { new: true },
  );
  if (!transaction) {
    throw new customError("Transaction not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Transaction updated successfully",
    transaction,
  );
});
