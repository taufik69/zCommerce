const express = require("express");
const _ = express.Router();
const variantController = require("../../controller/variant.controller");

_.route("/variant")
  .post(variantController.createVariant)
  .get(variantController.getAllVariants);

_.route("/variant/:id")
  .get(variantController.getSingleVariant)
  .put(variantController.updateVariant);
_.route("/variant/deactive").post(variantController.deactivateVariant);
_.route("/variant/active").post(variantController.activateVariant);

module.exports = _;
