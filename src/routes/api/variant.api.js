const express = require("express");
const _ = express.Router();
const variantController = require("../../controller/variant.controller");
const { anyFileUpload } = require("../../middleware/multer.middleware");

_.route("/variant")
  .post(anyFileUpload(), variantController.createVariant)
  .get(variantController.getAllVariants);

_.route("/search-variant").get(variantController.searchVariants);
_.route("/variant/deactive").post(variantController.deactivateVariant);
_.route("/variant/active").post(variantController.activateVariant);

_.route("/variant/:slug")
  .get(variantController.getSingleVariant)
  .put(anyFileUpload(), variantController.updateVariant)
  .delete(variantController.deleteVariant);

module.exports = _;
