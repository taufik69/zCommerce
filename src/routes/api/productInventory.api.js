const express = require("express");
const _ = express.Router();
const productInventoryController = require("../../controller/productInventory.controller");

_.route("/createproduct").post(
  productInventoryController.createProductInventory
);

module.exports = _;
