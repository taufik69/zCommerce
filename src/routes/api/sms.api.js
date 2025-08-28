const express = require("express");
const _ = express.Router();
const smsController = require("../../controller/sms.controller");
_.route("/send-sms").post(smsController.sendSMS);
_.route("/bulk-sms").post(smsController.sendBulkSMS);
_.route("/sms-blance").get(smsController.smsBlance);
_.route("/user-phone").get(smsController.getAllUserPhoneNumber);
_.route("/order-phone").get(smsController.getAllOrderPhoneNumber);

module.exports = _;
