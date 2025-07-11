const express = require("express");
const _ = express.Router();
const productInventoryController = require("../../controller/productInventory.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/createproduct").post(
  authGuard,
  authorize("productinventory", "add"),
  productInventoryController.createProductInventory
);
_.route("/getallproductinventory").get(
  // authGuard,
  // authorize("productinventory", "view"),
  productInventoryController.getAllProductInventory
);
_.route("/getproduct-inventory/:slug").get(
  // authGuard,
  // authorize("productinventory", "view"),
  productInventoryController.getProductInventoryBySlug
);

_.route("/updateproduct/:slug").put(
  productInventoryController.updateProductInventory
);

_.route("/searchproduct").get(
  productInventoryController.searchProductInventoryBySlug
);
_.route("/getproductinorder").get(
  productInventoryController.getProductInventoryInOrder
);

_.route("/productpagination").get(
  productInventoryController.getProductInventoryPagination
);

_.route("/Productdeactive").get(
  productInventoryController.deactivateProductInventoryBySlug
);
_.route("/Productactive").get(
  productInventoryController.activateProductInventoryBySlug
);

_.route("/productpricerange").get(
  productInventoryController.searchProductInventoryByPriceRange
);
_.route("/productpricelowtohigh").get(
  productInventoryController.searchProductInventoryLowToHigh
);

_.route("/productpricehightolow").get(
  productInventoryController.searchProductInventoryHighToLow
);

_.route("/productinventory/:id").delete(
  productInventoryController.deleteProductInventoryBySlug
);

module.exports = _;
