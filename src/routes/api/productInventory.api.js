const express = require("express");
const _ = express.Router();
const productInventoryController = require("../../controller/productInventory.controller");

_.route("/createproduct").post(
  productInventoryController.createProductInventory
);
_.route("/getallproductinventory").get(
  productInventoryController.getAllProductInventory
);
_.route("/getproduct/:slug").get(
  productInventoryController.getProductInventoryBySlug
);

module.exports = _;
