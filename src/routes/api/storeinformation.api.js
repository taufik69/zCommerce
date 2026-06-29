const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const storeInformationController = require("../../controller/storeInformation.controller");

_.route("/store-information")
  .post(
    authGuard,
    authorize("site-information", "add"),
    singleFileUpload("image"),
    storeInformationController.createStoreInformation,
  )
  .get(
    authGuard,
    authorize("site-information", "view"),
    storeInformationController.getAllStoreInformation,
  );

_.route("/store-information/search").get(
  authGuard,
  authorize("site-information", "view"),
  storeInformationController.searchStoreInformation,
);

_.route("/store-information/:slug")
  .get(
    authGuard,
    authorize("site-information", "view"),
    storeInformationController.getSingleStoreInformation,
  )
  .put(
    authGuard,
    authorize("site-information", "edit"),
    singleFileUpload("image"),
    storeInformationController.updateStoreInformation,
  )
  .delete(
    authGuard,
    authorize("site-information", "delete"),
    storeInformationController.deleteStoreInformation,
  );

_.route("/store-information/:slug/activate").put(
  authGuard,
  authorize("site-information", "edit"),
  storeInformationController.activateStoreInformation,
);

_.route("/store-information/:slug/deactivate").put(
  authGuard,
  authorize("site-information", "edit"),
  storeInformationController.deactivateStoreInformation,
);

module.exports = _;
