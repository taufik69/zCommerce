const express = require("express");
const _ = express.Router();
const productInventoryController = require("../../controller/productInventory.controller");

// _.route("/productinventory").post(productInventoryController.createProductInventory);
_.route("/createproduct").post(() => {
  console.log("hi hello");
});

module.exports = _;
