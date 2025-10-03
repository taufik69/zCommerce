const { customError } = require("../lib/CustomError");
const MoneyTransfer = require("../models/moneyTransfer.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

// create money transfer
exports.createMoneyTransfer = asynchandeler(async (req, res) => {
  const {
    date,
    fromAccount,
    toAccount,
    transactionDesction,
    amount,
    voucherNumber,
  } = req.body;

  if (!fromAccount || !toAccount || !amount) {
    throw new customError(
      "fromAccount, toAccount and amount are required",
      400
    );
  }

  const result = await MoneyTransfer.create({
    date,
    fromAccount,
    toAccount,
    transactionDesction,
    amount,
    voucherNumber,
  });

  if (!result) {
    throw new customError("Money Transfer not created", 400);
  }

  apiResponse.sendSuccess(res, 200, "Money Transfer created", result);
});

// get all money transfer
exports.getAllMoneyTransfer = asynchandeler(async (req, res) => {
  const result = await MoneyTransfer.find()
    .populate("fromAccount")
    .populate("toAccount")
    .sort({ createdAt: -1 });
  if (!result.length) {
    throw new customError("Money Transfer not found", 400);
  }
  apiResponse.sendSuccess(res, 200, "Money Transfer fetched", result);
});

// get single money transfer
exports.getSingleMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const result = await MoneyTransfer.findOne({ _id: id })
    .populate("fromAccount")
    .populate("toAccount");
  if (!result) {
    throw new customError("Money Transfer not found", 400);
  }
  apiResponse.sendSuccess(res, 200, "Money Transfer fetched", result);
});

// update single money transfer
exports.updateMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("Id is required", 400);
  }
  const result = await MoneyTransfer.findOneAndUpdate({ _id: id }, req.body);
  if (!result) {
    throw new customError("Money Transfer not found", 400);
  }
  apiResponse.sendSuccess(res, 200, "Money Transfer updated", result);
});

// delete single money transfer
exports.deleteMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("Id is required", 400);
  }
  const result = await MoneyTransfer.findOneAndDelete({ _id: id });
  if (!result) {
    throw new customError("Money Transfer not found", 400);
  }
  apiResponse.sendSuccess(res, 200, "Money Transfer deleted", result);
});
