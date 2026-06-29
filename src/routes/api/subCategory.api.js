const express = require("express");
const _ = express.Router();
const subCategory = require("../../controller/subCategory.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/subcategories")
  .post(
    authGuard,
    authorize("sub-category", "add"),
    subCategory.createSubCategory,
  )
  .get(subCategory.getAllSubCategory);

// Search subcategories by name
_.route("/subcategories/search").get(subCategory.searchSubCategories);

_.route("/subcategories/:slug")
  .get(subCategory.getSubCategoryBySlug)
  .put(
    authGuard,
    authorize("sub-category", "edit"),
    subCategory.updateSubCategory,
  )
  .delete(
    authGuard,
    authorize("sub-category", "delete"),
    subCategory.deleteSubCategory,
  );

//   @desc activate a subcategory by slug
_.route("/subcategories/:slug/activate").put(
  authGuard,
  authorize("sub-category", "edit"),
  subCategory.activateSubCategory,
);

_.route("/subcategories/:slug/deactive").put(
  authGuard,
  authorize("sub-category", "edit"),
  subCategory.deactivateSubCategory,
);

// all inactive subcategories route
_.route("/subcategories-inactive").get(
  authGuard,
  authorize("sub-category", "view"),
  subCategory.getInactiveSubCategories,
);

_.route("/subcategories-active").get(subCategory.getActiveSubCategories);

module.exports = _;
