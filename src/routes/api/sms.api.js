const express = require("express");
const _ = express.Router();
const smsController = require("../../controller/sms.controller");
_.route("/send-sms").post(smsController.sendSMS);
_.route('/bulk-sms').post(smsController.sendBulkSMS);

module.exports = _;
