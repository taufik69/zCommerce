const { apiResponse } = require("../utils/apiResponse");
const Merchant = require("../models/marchant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { validateMerchant } = require("../validation/marchant.validation");
const { statusCodes } = require("../constant/constant");

// @desc create a new merchant
exports.createMerchant = asynchandeler(async (req, res) => {
  const merchantData = await validateMerchant(req);
  const newMerchant = new Merchant(merchantData);
  await newMerchant.save();
  if (!newMerchant) {
    throw new customError(
      "Failed to create merchant",
      statusCodes.SERVER_ERROR,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Merchant created successfully",
    newMerchant,
  );
});

// @desc get all merchants
exports.getAllMerchants = asynchandeler(async (req, res) => {
  const merchants = await Merchant.find({}).sort({ createdAt: -1 });
  if (!merchants || merchants?.length === 0) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "No merchants found",
      [],
    );
  }

  apiResponse.sendSuccess(
    res,
    200,
    "Merchants retrieved successfully",
    merchants,
  );
});

// @desc get a merchant by ID
exports.getMerchantById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const merchant = await Merchant.findById(id);
  if (!merchant) {
    throw new customError("Merchant not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Merchant retrieved successfully",
    merchant,
  );
});

// @desc update a merchant by ID
exports.updateMerchantById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const merchantData = await validateMerchant(req);
  const updatedMerchant = await Merchant.findByIdAndUpdate(id, merchantData, {
    new: true,
  });

  if (!updatedMerchant) {
    throw new customError(
      "Failed to update merchant",
      statusCodes.SERVER_ERROR,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Merchant updated successfully",
    updatedMerchant,
  );
});

//@desc delete a merchant by ID
exports.deleteMerchantById = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const deletedMerchant = await Merchant.findByIdAndDelete(id);
  if (!deletedMerchant) {
    throw new customError(
      "Failed to delete merchant",
      statusCodes.SERVER_ERROR,
    );
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Merchant deleted successfully",
    deletedMerchant,
  );
});
