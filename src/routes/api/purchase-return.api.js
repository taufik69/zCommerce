const express = require("express");
const _ = express.Router();
const purchaseReturnController = require("../../controller/purchaseReturn.controller");

_.route("/")
  .post(
    // authGuard,
    // authorize("purchase-return", "add"),
    purchaseReturnController.createPurchaseReturn,
  )
  .get(purchaseReturnController.getPurchaseReturn);

_.route("/:id")
  .get(purchaseReturnController.getSinglePurchaseReturn)
  .put(
    // authGuard,
    // authorize("purchase-return", "edit"),
    purchaseReturnController.updatePurchaseReturn,
  )
  .delete(
    // authGuard,
    // authorize("purchase-return", "delete"),
    purchaseReturnController.deletePurchaseReturn,
  );

module.exports = _;
