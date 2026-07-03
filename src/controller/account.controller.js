const { customError } = require("../lib/CustomError");
const Account = require("../models/account.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const NS = "account";
const CACHE_TTL = 60 * 60; // 1 hour

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

  await bumpNsVersion(NS);

  apiResponse.sendSuccess(res, 200, "Accounts added", results);
});

// get all accounts
exports.getAllAccounts = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  const query = search
    ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};

  const cacheKey = await buildCacheKey(NS, `page_${page}_limit_${limit}_search_${search}`);
  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      200,
      "Accounts fetched successfully",
      { ...cached, fromCache: true }
    );
  }

  const [accounts, total] = await Promise.all([
    Account.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Account.countDocuments(query),
  ]);

  if (!accounts.length && page === 1) {
    return apiResponse.sendSuccess(res, 200, "Accounts not found", {
      accounts: [],
      total: 0,
      page,
      limit,
      hasNextPage: false,
      fromCache: false,
    });
  }

  const payload = { accounts, total, page, limit, hasNextPage: page * limit < total };
  await setCache(cacheKey, payload, CACHE_TTL);

  apiResponse.sendSuccess(res, 200, "Accounts fetched successfully", payload);
});

// get single account using slug
exports.getSingleAccount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

  const cached = await getCache(cacheKey);
  if (cached) {
    return apiResponse.sendSuccess(
      res,
      200,
      "Account fetched successfully",
      { account: cached, fromCache: true }
    );
  }

  const account = await Account.findOne({ slug: slug }).lean();
  if (!account) throw new customError("Account not found", 404);

  await setCache(cacheKey, account, CACHE_TTL);

  apiResponse.sendSuccess(res, 200, "Account fetched successfully", {
    account,
  });
});

// update account using slug
exports.updateAccount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const account = await Account.findOneAndUpdate(
    { slug: slug },
    { ...req.body },
    {
      new: true,
    }
  );
  if (!account) throw new customError("Account not found", 404);

  await bumpNsVersion(NS);

  apiResponse.sendSuccess(res, 200, "Account updated successfully", account);
});

// delte account using slug
exports.deleteAccount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const account = await Account.findOneAndDelete({ slug: slug });
  if (!account) throw new customError("Account not found", 404);

  await bumpNsVersion(NS);

  apiResponse.sendSuccess(res, 200, "Account deleted successfully", account);
});
