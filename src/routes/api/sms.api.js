const express = require("express");
const _ = express.Router();
const smsController = require("../../controller/sms.controller");

_.route("/send-sms").post(smsController.sendSMS);
_.route("/bulk-sms").post(smsController.sendBulkSMS);
_.route("/sms-blance").get(smsController.smsBlance);
_.route("/user-phone").get(smsController.getAllUserPhoneNumber);
_.route("/order-phone").get(smsController.getAllOrderPhoneNumber);

// Due SMS routes
_.route("/due-sms/send-all").post(smsController.sendDueSmsToAllCustomers);
_.route("/due-sms/logs").get(smsController.getSmsLogs);
_.route("/due-sms/logs/:logId").get(smsController.getSmsLog);
_.route("/due-sms/send/:customerId").post(smsController.sendDueSmsToCustomer);

module.exports = _;
