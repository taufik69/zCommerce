const { customError } = require("../lib/CustomError");
const FundHandoverDescription = require("../models/fundHandoverDescription.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

// Create
exports.createFundHandover = asynchandeler(async (req, res) => {
  const {
    date,
    transactionDescription,
    name,
    voucherNumber,
    fundPaymentMode,
    amount,
  } = req.body;

  if (
    !date ||
    !transactionDescription ||
    !name ||
    !fundPaymentMode ||
    !amount
  ) {
    throw new customError(
      "All required fields must be provided",
      statusCodes.BAD_REQUEST,
    );
  }

  const fund = await FundHandoverDescription.create({
    date,
    transactionDescription,
    name,
    voucherNumber,
    fundPaymentMode,
    amount,
  });

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Fund Handover created successfully",
    fund,
  );
});

// Get All
exports.getAllFundHandovers = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.serial) {
    query.handoverSerialId = req.query.serial;
  }

  const [funds, total] = await Promise.all([
    FundHandoverDescription.find(query)
      .populate("fundPaymentMode")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FundHandoverDescription.countDocuments(query),
  ]);

  if (!funds.length && page === 1) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Fund Handovers not found", {
      funds: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
    });
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fund Handovers fetched successfully",
    { funds, total, page, limit, hasNextPage: page * limit < total },
  );
});

// Get By ID
exports.getFundHandoverById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const fund =
    await FundHandoverDescription.findById(id).populate("fundPaymentMode");
  if (!fund)
    throw new customError("Fund Handover not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fund Handover fetched successfully",
    fund,
  );
});

// Update
exports.updateFundHandover = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const updatedFund = await FundHandoverDescription.findByIdAndUpdate(
    id,
    { ...req.body },
    {
      new: true,
    },
  );

  if (!updatedFund)
    throw new customError("Fund Handover not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fund Handover updated successfully",
    updatedFund,
  );
});

// Delete
exports.deleteFundHandover = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const deletedFund = await FundHandoverDescription.findByIdAndDelete(id);
  if (!deletedFund)
    throw new customError("Fund Handover not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fund Handover deleted successfully",
    deletedFund,
  );
});
