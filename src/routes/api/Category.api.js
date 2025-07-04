const express = require("express");
const _ = express.Router();
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const Category = require("../../controller/category.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

// @desc   categories routes
_.route("/categories").post(
  authGuard,
  authorize("category", "add"),
  multipleFileUpload("image", 1),
  Category.createCategory
);
// @desc   get all categories
_.route("/categories").get(Category.getAllCategories);
_.route("/categories/:slug").get(Category.getCategoryBySlug);
// @desc   update category by slug
_.route("/categories/:slug").put(
  multipleFileUpload("image", 1),
  Category.updateCategory
);
_.route("/categories/:slug").delete(Category.deleteCategory);
_.route("/categories/:slug/activate").put(Category.activateCategory);
_.route("/categories/:slug/deactivate").put(Category.deactivateCategory);
// @desc   get all active categories
_.route("/categories-active").get(Category.getActiveCategories);
// @desc   get all inactive categories
_.route("/categories-inactive").get(Category.getInactiveCategories);
// @desc getCategoriesWithSearch using query
_.route("/categories-search").get(Category.getCategoriesWithSearch);

_.route("/categories-sort").get(Category.getCategoriesWithSort);

module.exports = _;
