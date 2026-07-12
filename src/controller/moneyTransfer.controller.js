const { customError } = require("../lib/CustomError");
const MoneyTransfer = require("../models/moneyTransfer.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

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
      statusCodes.BAD_REQUEST,
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
    throw new customError(
      "Money Transfer not created",
      statusCodes.SERVER_ERROR,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Money Transfer created",
    result,
  );
});

// get all money transfer
exports.getAllMoneyTransfer = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.serial) {
    query.transferSerialId = req.query.serial;
  }

  const [transfers, total] = await Promise.all([
    MoneyTransfer.find(query)
      .populate("fromAccount")
      .populate("toAccount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MoneyTransfer.countDocuments(query),
  ]);

  if (!transfers.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Money Transfer not found", {
      transfers: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer fetched",
    { transfers, total, page, limit, hasNextPage: page * limit < total },
  );
});

// get single money transfer
exports.getSingleMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const result = await MoneyTransfer.findOne({ _id: id })
    .populate("fromAccount")
    .populate("toAccount");
  if (!result) {
    throw new customError("Money Transfer not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer fetched",
    result,
  );
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
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer updated",
    result,
  );
});

// delete single money transfer
exports.deleteMoneyTransfer = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("Id is required", statusCodes.BAD_REQUEST);
  }
  const result = await MoneyTransfer.findOneAndDelete({ _id: id });
  if (!result) {
    throw new customError("Money Transfer not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Money Transfer deleted",
    result,
  );
});
