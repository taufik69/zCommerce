const express = require("express");
const _ = express.Router();
const purchaseReturnController = require("../../controller/purchaseReturn.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/")
  .post(authGuard, authorize("purchase-return", "add"), purchaseReturnController.createPurchaseReturn)
  .get(authGuard, authorize("purchase-return", "view"), purchaseReturnController.getPurchaseReturn);

_.route("/:id")
  .get(authGuard, authorize("purchase-return", "view"), purchaseReturnController.getSinglePurchaseReturn)
  .put(authGuard, authorize("purchase-return", "edit"), purchaseReturnController.updatePurchaseReturn)
  .delete(authGuard, authorize("purchase-return", "delete"), purchaseReturnController.deletePurchaseReturn);

module.exports = _;
