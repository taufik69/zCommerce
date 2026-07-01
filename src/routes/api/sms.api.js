const express = require("express");
const _ = express.Router();
const smsController = require("../../controller/sms.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");



_.route("/send-sms").post(
  authGuard,
  authorize("send-sms", "add"),
  smsController.sendSMS,
);
_.route("/bulk-sms").post(
  authGuard,
  authorize("send-bulk-sms", "add"),
  smsController.sendBulkSMS,
);
_.route("/sms-blance").get(
  authGuard,
  authorize("sms-info", "view"),
  smsController.smsBlance,
);
_.route("/user-phone").get(
  authGuard,
  authorize("send-sms", "view"),
  smsController.getAllUserPhoneNumber,
);
_.route("/order-phone").get(
  authGuard,
  authorize("send-sms", "view"),
  smsController.getAllOrderPhoneNumber,
);

// Due SMS routes
_.route("/due-sms/send-all").post(
  authGuard,
  authorize("send-bulk-sms", "add"),
  smsController.sendDueSmsToAllCustomers,
);
_.route("/due-sms/logs").get(
  authGuard,
  authorize("sms-info", "view"),
  smsController.getSmsLogs,
);
_.route("/due-sms/logs/:logId").get(
  authGuard,
  authorize("sms-info", "view"),
  smsController.getSmsLog,
);
_.route("/due-sms/send/:customerId").post(
  authGuard,
  authorize("send-sms", "add"),
  smsController.sendDueSmsToCustomer,
);

// Bulk SMS by recipient group (Logged / Order / Sales customers)
_.route("/recipient-counts").get(
  authGuard,
  authorize("send-bulk-sms", "view"),
  smsController.getRecipientCounts,
);
_.route("/bulk-sms/send").post(
  authGuard,
  authorize("send-bulk-sms", "add"),
  smsController.sendBulkSmsByGroup,
);
_.route("/campaigns").get(
  authGuard,
  authorize("sms-info", "view"),
  smsController.getSmsCampaigns,
);
_.route("/report/download").get(
  authGuard,
  authorize("sms-info", "view"),
  smsController.downloadSmsReport,
);

module.exports = _;
