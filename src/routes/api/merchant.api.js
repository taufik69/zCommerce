const express = require("express");
const _ = express.Router();
const merchantController = require("../../controller/marchant.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-merchant").post(
  authGuard,
  authorize("courier-merchant", "add"),
  merchantController.createMerchant,
);
_.route("/get-all-merchants").get(
  authGuard,
  authorize("courier-merchant", "view"),
  merchantController.getAllMerchants,
);
_.route("/get-merchant/:id").get(
  authGuard,
  authorize("courier-merchant", "view"),
  merchantController.getMerchantById,
);
_.route("/update-merchant/:id").put(
  authGuard,
  authorize("courier-merchant", "edit"),
  merchantController.updateMerchantById,
);
_.route("/delete-merchant/:id").delete(
  authGuard,
  authorize("courier-merchant", "delete"),
  merchantController.deleteMerchantById,
);

module.exports = _;
