const express = require("express");
const _ = express.Router();
const merchantController = require("../../controller/marchant.controller");

_.route("/create-merchant").post(merchantController.createMerchant);
_.route("/get-all-merchants").get(merchantController.getAllMerchants);
_.route("/get-merchant/:id").get(merchantController.getMerchantById);
_.route("/update-merchant/:id").put(merchantController.updateMerchantById);
_.route("/delete-merchant/:id").delete(merchantController.deleteMerchantById);
module.exports = _;
