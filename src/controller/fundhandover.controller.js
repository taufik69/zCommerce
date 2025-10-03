const { customError } = require("../lib/CustomError");
const FundHandoverDescription = require("../models/fundHandoverDescription.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

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
    throw new customError("All required fields must be provided", 400);
  }

  const fund = await FundHandoverDescription.create({
    date,
    transactionDescription,
    name,
    voucherNumber,
    fundPaymentMode,
    amount,
  });

  apiResponse.sendSuccess(res, 201, "Fund Handover created successfully", fund);
});

// Get All
exports.getAllFundHandovers = asynchandeler(async (req, res) => {
  const funds = await FundHandoverDescription.find()
    .populate("fundPaymentMode")
    .sort({ createdAt: -1 });
  if (!funds.length) throw new customError("Fund Handovers not found", 404);
  apiResponse.sendSuccess(
    res,
    200,
    "Fund Handovers fetched successfully",
    funds
  );
});

// Get By ID
exports.getFundHandoverById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const fund = await FundHandoverDescription.findById(id).populate(
    "fundPaymentMode"
  );
  if (!fund) throw new customError("Fund Handover not found", 404);
  apiResponse.sendSuccess(res, 200, "Fund Handover fetched successfully", fund);
});

// Update
exports.updateFundHandover = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const updatedFund = await FundHandoverDescription.findByIdAndUpdate(
    id,
    { ...req.body },
    {
      new: true,
    }
  );

  if (!updatedFund) throw new customError("Fund Handover not found", 404);

  apiResponse.sendSuccess(
    res,
    200,
    "Fund Handover updated successfully",
    updatedFund
  );
});

// Delete
exports.deleteFundHandover = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const deletedFund = await FundHandoverDescription.findByIdAndDelete(id);
  if (!deletedFund) throw new customError("Fund Handover not found", 404);

  apiResponse.sendSuccess(
    res,
    200,
    "Fund Handover deleted successfully",
    deletedFund
  );
});
