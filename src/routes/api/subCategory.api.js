const express = require("express");
const _ = express.Router();
const subCategory = require("../../controller/subCategory.controller");

// const { authGuard } = require("../../middleware/authMiddleware");
// const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/subcategories")
  .post(
    // authGuard,
    // authorize("subcategory", "add"),
    subCategory.createSubCategory,
  )
  .get(subCategory.getAllSubCategory);

// Search subcategories by name
_.route("/subcategories/search").get(
  // authGuard,
  // authorize("subcategory", "view"),
  subCategory.searchSubCategories,
);

_.route("/subcategories/:slug")
  .get(subCategory.getSubCategoryBySlug)
  .put(
    // authGuard,
    // authorize("subcategory", "edit"),
    subCategory.updateSubCategory,
  )
  .delete(
    // authGuard,
    // authorize("subcategory", "delete"),
    subCategory.deleteSubCategory,
  );

//   @desc activate a subcategory by slug
_.route("/subcategories/:slug/activate").put(
  // authGuard,
  // authorize("subcategory", "edit"),
  subCategory.activateSubCategory,
);

_.route("/subcategories/:slug/deactive").put(
  // authGuard,
  // authorize("subcategory", "edit"),
  subCategory.deactivateSubCategory,
);

// all inactive subcategories route
_.route("/subcategories-inactive").get(
  // authGuard,
  // authorize("subcategory", "view"),
  subCategory.getInactiveSubCategories,
);

_.route("/subcategories-active").get(
  // authGuard,
  // authorize("subcategory", "view"),
  subCategory.getActiveSubCategories,
);

module.exports = _;
