const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { validateBrand } = require("../validation/brand.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const purchaseModel = require("../models/purchase.model");

// @desc    Create a new brand
// @route   POST /api/v1/brand
exports.createInvoice = asynchandeler(async (req, res) => {});
