const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { sendSMS } = require("../helpers/sms");

exports.sendSMS = asynchandeler(async (req, res) => {
  const { message, phoneNumber } = req.body;

  if (!message || !phoneNumber) {
    throw new customError("Message and phone number are required", 400);
  }
  const result = await sendSMS(phoneNumber, message);
  return apiResponse.sendSuccess(res, 200, "SMS sent successfully", result);
});

// @desc sendBulkSMS controller  parraller send a bluk amount of sms
exports.sendBulkSMS = asynchandeler(async (req, res) => {
  const { message, phoneNumber } = req.body;

  if (!message || !phoneNumber) {
    throw new customError("Message and phone number are required", 400);
  }
  const result = await sendSMS(phoneNumber, message);
  return apiResponse.sendSuccess(res, 200, "SMS sent successfully", result);
});
