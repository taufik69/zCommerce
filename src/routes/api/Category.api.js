const express = require("express");
const _ = express.Router();
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const Category = require("../../controller/category.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

// @desc   categories routes
_.route("/categories").post(
  // authGuard,
  // authorize("category", "add"),
  multipleFileUpload("image", 10),
  Category.createCategory
);
// @desc   get all categories
_.route("/categories").get(Category.getAllCategories);
_.route("/categories/:slug").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getCategoryBySlug
);
// @desc   update category by slug
_.route("/categories/:slug").put(
  // authGuard,
  // authorize("category", "update"),
  multipleFileUpload("image", 1),
  Category.updateCategory
);
_.route("/categories/:slug").delete(
  // authGuard,
  // authorize("category", "delete"),
  Category.deleteCategory
);
_.route("/categories/:slug/activate").put(
  // authGuard,
  // authorize("category", "update"),
  Category.activateCategory
);
_.route("/categories/:slug/deactivate").put(
  // authGuard,
  // authorize("category", "update"),
  Category.deactivateCategory
);
// @desc   get all active categories
_.route("/categories-active").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getActiveCategories
);
// @desc   get all inactive categories
_.route("/categories-inactive").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getInactiveCategories
);
// @desc getCategoriesWithSearch using query
_.route("/categories-search").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getCategoriesWithSearch
);

_.route("/categories-sort").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getCategoriesWithSort
);

_.route("/category-pagination").get(
  // authGuard,
  // authorize("category", "view"),
  Category.getCategoryPagination
);

module.exports = _;
