const express = require("express");
const _ = express.Router();
const purchaseController = require("../../controller/purchase.controller");

_.route("/add-purchase").post(purchaseController.createPurchase);
_.route("/all-allpurchases").get(purchaseController.getAllPurchases);
_.route("/single-purchase/:id").get(purchaseController.getSinglePurchase);
_.route("/update-purchase/:id").put(purchaseController.updatePurchase);
_.route("/delete-purchase/:id").delete(purchaseController.deletePurchase);
module.exports = _;
