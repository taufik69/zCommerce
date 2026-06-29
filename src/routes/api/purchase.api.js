const express = require("express");
const _ = express.Router();
const purchaseController = require("../../controller/purchase.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/add-purchase").post(authGuard, authorize("purchase", "add"), purchaseController.createPurchase);
_.route("/all-allpurchases").get(authGuard, authorize("purchase", "view"), purchaseController.getAllPurchases);
_.route("/search-purchase").get(authGuard, authorize("purchase", "view"), purchaseController.searchPurchase);
_.route("/single-purchase/:id").get(authGuard, authorize("purchase", "view"), purchaseController.getSinglePurchase);
_.route("/update-purchase/:id").put(authGuard, authorize("purchase", "edit"), purchaseController.updatePurchase);
_.route("/delete-purchase/:id").delete(authGuard, authorize("purchase", "delete"), purchaseController.deletePurchase);

module.exports = _;
