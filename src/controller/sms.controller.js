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
const {
  RECIPIENT_TYPES,
  resolveRecipients,
  countRecipients,
} = require("../helpers/smsRecipients");

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

/* =========================================================================
 * Bulk SMS by recipient group (Logged / Order / Sales customers)
 * ========================================================================= */

// @desc Get recipient counts for every group (dynamic dropdown counts)
exports.getRecipientCounts = asynchandeler(async (req, res) => {
  const counts = await countRecipients();
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Recipient counts fetched",
    { counts, labels: RECIPIENT_TYPES },
  );
});

// @desc Send bulk SMS to a recipient group — queued via BullMQ worker
exports.sendBulkSmsByGroup = asynchandeler(async (req, res) => {
  const { message, recipientType } = req.body;

  if (!message || !message.trim()) {
    throw new customError("Message is required", statusCodes.BAD_REQUEST);
  }
  if (!RECIPIENT_TYPES[recipientType]) {
    throw new customError(
      "Invalid recipient type. Use one of: logged, order, sales",
      statusCodes.BAD_REQUEST,
    );
  }

  const resolved = await resolveRecipients(recipientType);
  if (!resolved || resolved.length === 0) {
    throw new customError(
      `No recipients found for ${RECIPIENT_TYPES[recipientType]}`,
      statusCodes.NOT_FOUND,
    );
  }

  const recipients = resolved.map((r) => ({
    customerId: r.customerId || undefined,
    name: r.name || "",
    phone: r.phone,
    status: "pending",
  }));

  const sentByName = req.user?.name || req.user?.email || "admin";

  const log = await SmsLog.create({
    type: "bulk",
    recipientType,
    message: message.trim(),
    totalCount: recipients.length,
    sentCount: 0,
    failedCount: 0,
    status: "queued",
    recipients,
    triggeredBy: sentByName,
    sentBy: req.user?._id,
    sentByName,
  });

  const job = await smsQueue.add(
    "send-bulk-sms-group",
    {
      logId: log._id.toString(),
      message: message.trim(),
      recipientType,
      recipients: recipients.map((r, index) => ({
        index,
        customerId: r.customerId ? r.customerId.toString() : null,
        phone: r.phone,
      })),
    },
    { jobId: log._id.toString() },
  );

  await SmsLog.updateOne({ _id: log._id }, { $set: { jobId: job.id } });

  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    `Bulk SMS queued for ${recipients.length} ${RECIPIENT_TYPES[recipientType]}.`,
    {
      logId: log._id,
      jobId: job.id,
      recipientType,
      totalCount: recipients.length,
      status: "queued",
    },
  );
});

// @desc Get SMS campaigns (history / status), filterable by recipientType
exports.getSmsCampaigns = asynchandeler(async (req, res) => {
  const { recipientType, status } = req.query;

  const filter = { type: "bulk" };
  if (recipientType && RECIPIENT_TYPES[recipientType]) {
    filter.recipientType = recipientType;
  }
  if (status) {
    filter.status = status;
  }

  const campaigns = await SmsLog.find(filter)
    .select("-recipients")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  if (!campaigns || campaigns.length === 0) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No SMS campaigns found", {
      campaigns: [],
      fromCache: false,
    });
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "SMS campaigns fetched", {
    campaigns,
    fromCache: false,
  });
});

// @desc Download SMS report (csv | xls) — optional recipientType filter
exports.downloadSmsReport = asynchandeler(async (req, res) => {
  const { recipientType, format = "csv" } = req.query;

  const filter = { type: "bulk" };
  if (recipientType && RECIPIENT_TYPES[recipientType]) {
    filter.recipientType = recipientType;
  }

  const campaigns = await SmsLog.find(filter)
    .select("-recipients")
    .sort({ createdAt: -1 })
    .lean();

  const rows = campaigns.map((c) => ({
    "Campaign Date": new Date(c.createdAt).toLocaleString(),
    "Recipient Type": RECIPIENT_TYPES[c.recipientType] || c.recipientType || "",
    "SMS Content": (c.message || "").replace(/\s+/g, " ").trim(),
    "Total Recipients": c.totalCount || 0,
    Successful: c.sentCount || 0,
    Failed: c.failedCount || 0,
    "Sent By": c.sentByName || c.triggeredBy || "admin",
    Status: c.status || "",
  }));

  const headers = [
    "Campaign Date",
    "Recipient Type",
    "SMS Content",
    "Total Recipients",
    "Successful",
    "Failed",
    "Sent By",
    "Status",
  ];

  const ts = new Date().toISOString().slice(0, 10);

  if (format === "xls" || format === "xlsx") {
    // Excel-openable HTML table (no external dependency)
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
    const tbody = rows
      .map(
        (r) =>
          `<tr>${headers.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`,
      )
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/></head><body><table border="1">${thead}${tbody}</table></body></html>`;

    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sms-report-${ts}.xls"`,
    );
    return res.send(html);
  }

  // Default: CSV
  const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="sms-report-${ts}.csv"`,
  );
  return res.send("﻿" + csv); // BOM for Excel UTF-8
});
