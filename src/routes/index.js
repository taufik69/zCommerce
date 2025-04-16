const express = require("express");
const { customError } = require("../lib/CustomError");
const Category = require("../controller/category.controller");
const { multipleFileUpload } = require("../middleware/multer.middleware");
const _ = express.Router();
_.route("/categories").post(
  multipleFileUpload("image", 10),
  Category.createCategory
);

_.route("*").all(() => {
  throw new customError("Route not found", 404);
});
module.exports = _;
