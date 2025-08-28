const express = require("express");
const _ = express.Router();
const variantController = require("../../controller/variant.controller");
const { multipleFileUpload } = require("../../middleware/multer.middleware");

_.route("/variant")
  .post(multipleFileUpload("image", 15), variantController.createVariant)
  .get(variantController.getAllVariants);

_.route("/variant/:slug")
  .get(variantController.getSingleVariant)
  .put(multipleFileUpload("image", 5), variantController.updateVariant)
  .delete(variantController.deleteVariant);

_.route("/variant/deactive").post(variantController.deactivateVariant);
_.route("/variant/active").post(variantController.activateVariant);

module.exports = _;
