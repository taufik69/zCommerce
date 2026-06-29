const express = require("express");
const _ = express.Router();
const stockAdjustController = require("../../controller/stockAdjust.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/stock-adjust")
  .post(
    authGuard,
    authorize("stock-adjustment", "add"),
    stockAdjustController.createStockAdjust,
  )
  .get(
    authGuard,
    authorize("stock-adjustment", "view"),
    stockAdjustController.getAllStockAdjusts,
  );

_.route("/stock-adjust/category/:category").get(
  authGuard,
  authorize("stock-adjustment", "view"),
  stockAdjustController.getAllProductCategoryWise,
);

_.route("/stock-adjust/subcategory/:subcategory").get(
  authGuard,
  authorize("stock-adjustment", "view"),
  stockAdjustController.getAllProductSSubcategoryWise,
);
_.route("/getallmultiplevariant").get(
  authGuard,
  authorize("stock-adjustment", "view"),
  stockAdjustController.getAllVariants,
);
_.route("/getsinglevariant").get(
  authGuard,
  authorize("stock-adjustment", "view"),
  stockAdjustController.getSingleVariant,
);
_.route("/deletestockadjust/:id").delete(
  authGuard,
  authorize("stock-adjustment", "delete"),
  stockAdjustController.deleteStockAdjustById,
);

_.route("/stock-adjust/:id")
  .get(
    authGuard,
    authorize("stock-adjustment", "view"),
    stockAdjustController.getStockAdjustById,
  )
  .put(
    authGuard,
    authorize("stock-adjustment", "edit"),
    stockAdjustController.updateStockAdjustById,
  );

module.exports = _;
