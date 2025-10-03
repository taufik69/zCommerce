const { customError } = require("../lib/CustomError");
const Account = require("../models/account.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

// create multiple account name
exports.createAccount = asynchandeler(async (req, res) => {
  const { accounts } = req.body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new customError("Accounts is required", 400);
  }

  const results = [];

  for (const name of accounts) {
    const accountName = new Account({ name });
    try {
      await accountName.save(); //
      results.push(accountName);
    } catch (err) {
      console.log(err.message);
    }
  }

  apiResponse.sendSuccess(res, 200, "Accounts added", results);
});

// get all accounts
exports.getAllAccounts = asynchandeler(async (req, res) => {
  const accounts = await Account.find().sort({ createdAt: -1 });
  if (!accounts.length) {
    throw new customError("Accounts not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Accounts fetched successfully", accounts);
});

// get single account using slug
exports.getSingleAccount = async (req, res) => {
  const { slug } = req.params;
  const account = await Account.findOne({ slug: slug });
  if (!account) throw new customError("Account not found", 404);
  apiResponse.sendSuccess(res, 200, "Account fetched successfully", account);
};

// update account using slug
exports.updateAccount = async (req, res) => {
  const { slug } = req.params;
  const account = await Account.findOneAndUpdate(
    { slug: slug },
    { ...req.body },
    {
      new: true,
    }
  );
  if (!account) throw new customError("Account not found", 404);
  apiResponse.sendSuccess(res, 200, "Account updated successfully", account);
};

// delte account using slug
exports.deleteAccount = async (req, res) => {
  const { slug } = req.params;
  const account = await Account.findOneAndDelete({ slug: slug });
  if (!account) throw new customError("Account not found", 404);
  apiResponse.sendSuccess(res, 200, "Account deleted successfully", account);
};
