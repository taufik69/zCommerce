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

_.route("/updateproduct/:slug").put(
  productInventoryController.updateProductInventory
);

_.route("/searchproduct").get(
  productInventoryController.searchProductInventoryBySlug
);

module.exports = _;
