const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { sendSMS } = require("../helpers/sms");
const User = require("../models/user.model");
const Order = require("../models/order.model");
const { customerModel } = require("../models/customer.model");
const SmsLog = require("../models/smsLog.model");
const { smsQueue } = require("../queues/sms.queue");
const { default: axios } = require("axios");
const { statusCodes } = require("../constant/constant");

exports.sendSMS = asynchandeler(async (req, res) => {
  const { message, phoneNumber } = req.body;

  if (!message || !phoneNumber) {
    throw new customError(
      "Message and phone number are required",
      statusCodes.BAD_REQUEST,
    );
  }
  const result = await sendSMS(phoneNumber, message);
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SMS sent successfully",
    result,
  );
});

// @desc sendBulkSMS controller  parraller send a bluk amount of sms
exports.sendBulkSMS = asynchandeler(async (req, res) => {
  const { message, phoneNumber } = req.body;

  if (!message || !phoneNumber) {
    throw new customError(
      "Message and phone number are required",
      statusCodes.BAD_REQUEST,
    );
  }
  const result = await sendSMS(phoneNumber, message);
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SMS sent successfully",
    result,
  );
});

// @desc check sms balace
exports.smsBlance = asynchandeler(async (req, res) => {
  const response = await axios.get(
    `http://bulksmsbd.net/api/getBalanceApi?api_key=${process.env.BULK_SMS_API_KEY}`,
  );
  if (response.data.error) {
    throw new customError(response.data.error, statusCodes.BAD_REQUEST);
  }

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SMS balace",
    response.data,
  );
});

// @desc get all user phone number
exports.getAllUserPhoneNumber = asynchandeler(async (req, res) => {
  const users = await User.find().select("phone");
  if (!users || users.length === 0)
    throw new customError("User not found", statusCodes.NOT_FOUND);
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User fetched successfully",
    users,
  );
});

//@desc get all order phone number
exports.getAllOrderPhoneNumber = asynchandeler(async (req, res) => {
  const orders = await Order.find().select("shippingInfo.phone");
  const phoneNumbers = orders.map((order) => {
    return { _id: order._id, phone: order.shippingInfo.phone };
  });
  if (!phoneNumbers || phoneNumbers.length === 0)
    throw new customError("Order not found", statusCodes.NOT_FOUND);
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Order fetched successfully",
    phoneNumbers,
  );
});

// @desc Send due SMS to a single customer
exports.sendDueSmsToCustomer = asynchandeler(async (req, res) => {
  const { customerId } = req.params;
  const { message } = req.body;

  if (!message) {
    throw new customError("Message is required", statusCodes.BAD_REQUEST);
  }

  const customer = await customerModel.findById(customerId).select("fullName mobileNumber openingDues isActive");
  if (!customer) {
    throw new customError("Customer not found", statusCodes.NOT_FOUND);
  }
  if (!customer.isActive) {
    throw new customError("Customer is inactive", statusCodes.BAD_REQUEST);
  }

  const result = await sendSMS(customer.mobileNumber, message);

  const log = await SmsLog.create({
    type: "single",
    message,
    totalCount: 1,
    sentCount: 1,
    failedCount: 0,
    status: "completed",
    recipients: [
      {
        customerId: customer._id,
        phone: customer.mobileNumber,
        status: "sent",
      },
    ],
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "SMS sent successfully", {
    logId: log._id,
    result,
  });
});

// @desc Send due SMS to all customers (queued via BullMQ worker)
exports.sendDueSmsToAllCustomers = asynchandeler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    throw new customError("Message is required", statusCodes.BAD_REQUEST);
  }

  const customers = await customerModel
    .find({ isActive: true, deletedAt: null })
    .select("_id fullName mobileNumber openingDues");

  if (!customers || customers.length === 0) {
    throw new customError("No active customers found", statusCodes.NOT_FOUND);
  }

  const recipients = customers.map((c) => ({
    customerId: c._id,
    phone: c.mobileNumber,
    status: "pending",
  }));

  const log = await SmsLog.create({
    type: "bulk",
    message,
    totalCount: customers.length,
    sentCount: 0,
    failedCount: 0,
    status: "queued",
    recipients,
  });

  const job = await smsQueue.add(
    "send-due-sms-bulk",
    {
      logId: log._id.toString(),
      message,
      recipients: recipients.map((r) => ({
        customerId: r.customerId.toString(),
        phone: r.phone,
      })),
    },
    { jobId: log._id.toString() },
  );

  await SmsLog.updateOne({ _id: log._id }, { $set: { jobId: job.id } });

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Bulk SMS queued successfully. You will be notified when complete.",
    {
      logId: log._id,
      jobId: job.id,
      totalCount: customers.length,
      status: "queued",
    },
  );
});

// @desc Get SMS log by id
exports.getSmsLog = asynchandeler(async (req, res) => {
  const { logId } = req.params;
  const log = await SmsLog.findById(logId).populate("recipients.customerId", "fullName mobileNumber");
  if (!log) {
    throw new customError("SMS log not found", statusCodes.NOT_FOUND);
  }
  return apiResponse.sendSuccess(res, statusCodes.OK, "SMS log fetched", log);
});

// @desc Get all SMS logs (history)
exports.getSmsLogs = asynchandeler(async (req, res) => {
  const logs = await SmsLog.find().sort({ createdAt: -1 }).limit(100);
  if (!logs || logs.length === 0) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No SMS logs found", { logs: [], fromCache: false });
  }
  return apiResponse.sendSuccess(res, statusCodes.OK, "SMS logs fetched", { logs, fromCache: false });
});
