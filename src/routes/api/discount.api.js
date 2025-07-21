const express = require("express");
const _ = express.Router();
const discountController = require("../../controller/discount.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/discount")
  .post(
    // authGuard,
    // authorize("discount", "add"),
    discountController.createDiscount
  )
  .get(
    // authGuard,
    // authorize("discount", "view"),
    discountController.getAllDiscounts
  );

_.route("/discount/:slug")
  .get(
    // authGuard,
    // authorize("discount", "view"),
    discountController.getDiscountBySlug
  )
  .put(
    // authGuard,
    // authorize("discount", "update"),
    discountController.updateDiscount
  )
  .delete(
    // authGuard,
    // authorize("discount", "delete"),
    discountController.deleteDiscount
  );

_.route("/discount/deactive").post(
  // authGuard,
  // authorize("discount", "update"),
  discountController.deactivateDiscount
);
_.route("/discount/active").post(
  // authGuard,
  // authorize("discount", "update"),
  discountController.activateDiscount
);
_.route("/discountpagination").get(
  // authGuard,
  // authorize("discount", "view"),
  discountController.getDiscountPagination
);

module.exports = _;
