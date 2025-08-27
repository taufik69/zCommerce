const express = require("express");
const _ = express.Router();
const subCategory = require("../../controller/subCategory.controller");
_.route("/subcategories")
  .post(subCategory.createSubCategories)
  .get(subCategory.getAllSubCategory);

_.route("/subcategories/:slug")
  .get(subCategory.getSubCategoryBySlug)
  .put(subCategory.updateSubCategory)
  .delete(subCategory.deleteSubCategory);

//   @desc activete a subcategory by slug
_.route("/subcategories/:slug/activate").put(subCategory.activateSubCategory);
_.route("/subcategories/:slug/deactive").put(subCategory.deactivateSubCategory);
// all inactive subcategories route
_.route("/subcategories-inactive").get(subCategory.getInactiveSubCategories);
_.route("/subcategories-active").get(subCategory.getActiveSubCategories);

module.exports = _;
