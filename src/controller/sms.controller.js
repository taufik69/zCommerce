const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { sendSMS } = require("../helpers/sms");
const User = require("../models/user.model");
const Order = require("../models/order.model");
const { default: axios } = require("axios");

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

// @desc check sms balace
exports.smsBlance = asynchandeler(async (req, res) => {
  const response = await axios.get(
    `http://bulksmsbd.net/api/getBalanceApi?api_key=${process.env.BULK_SMS_API_KEY}`
  );
  if (response.data.error) {
    throw new customError(response.data.error, 400);
  }

  return apiResponse.sendSuccess(res, 202, "SMS balace", response.data);
});

// @desc get all user phone number
exports.getAllUserPhoneNumber = asynchandeler(async (req, res) => {
  const users = await User.find().select("phone");
  return apiResponse.sendSuccess(res, 200, "User fetched successfully", users);
});

//@desc get all order phone number
exports.getAllOrderPhoneNumber = asynchandeler(async (req, res) => {
  const orders = await Order.find().select("shippingInfo.phone");
  const phoneNumbers = orders.map((order) => {
    return { _id: order._id, phone: order.shippingInfo.phone };
  });
  return apiResponse.sendSuccess(
    res,
    200,
    "Order fetched successfully",
    phoneNumbers
  );
});
