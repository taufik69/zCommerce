const express = require("express");
const _ = express.Router();
const { multipleFileUpload } = require("../../middleware/multer.middleware");
const Category = require("../../controller/category.controller");

// @desc   categories routes
_.route("/categories").post(
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
module.exports = _;
