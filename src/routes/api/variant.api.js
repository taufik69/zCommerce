const express = require("express");
const _ = express.Router();
const variantController = require("../../controller/variant.controller");
const {
  anyFileUpload,
  multipleFileUploadWithFields,
} = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/variant")
  .post(
    authGuard,
    authorize("variant", "add"),
    anyFileUpload(),
    variantController.createVariant,
  )
  .get(
    authGuard,
    authorize("variant", "view"),
    variantController.getAllVariants,
  );

_.route("/search-variant").get(
  authGuard,
  authorize("variant", "view"),
  variantController.searchVariants,
);

_.route("/variant/deactive").post(
  authGuard,
  authorize("variant", "edit"),
  variantController.deactivateVariant,
);

_.route("/variant/active").post(
  authGuard,
  authorize("variant", "edit"),
  variantController.activateVariant,
);

_.route("/addvariantimage/:slug").post(
  authGuard,
  authorize("variant", "edit"),
  multipleFileUploadWithFields([{ name: "image", maxCount: 10 }]),
  variantController.addVariantImage,
);

_.route("/deletevariantimage/:slug").delete(
  authGuard,
  authorize("variant", "edit"),
  variantController.deleteVariantImage,
);

_.route("/variant/:slug")
  .get(
    authGuard,
    authorize("variant", "view"),
    variantController.getSingleVariant,
  )
  .put(
    authGuard,
    authorize("variant", "edit"),
    anyFileUpload(),
    variantController.updateVariant,
  )
  .delete(
    authGuard,
    authorize("variant", "delete"),
    variantController.deleteVariant,
  );

module.exports = _;
