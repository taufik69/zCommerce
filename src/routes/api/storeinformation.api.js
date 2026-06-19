const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const storeInformationController = require("../../controller/storeInformation.controller");

_.route("/store-information")
  .post(
    // authGuard,
    // authorize("storeinformation", "add"),
    singleFileUpload("image"),
    storeInformationController.createStoreInformation,
  )
  .get(storeInformationController.getAllStoreInformation);

_.route("/store-information/search").get(
  storeInformationController.searchStoreInformation,
);

_.route("/store-information/:slug")
  .get(storeInformationController.getSingleStoreInformation)
  .put(
    // authGuard,
    // authorize("storeinformation", "edit"),
    singleFileUpload("image"),
    storeInformationController.updateStoreInformation,
  )
  .delete(
    // authGuard,
    // authorize("storeinformation", "delete"),
    storeInformationController.deleteStoreInformation,
  );

_.route("/store-information/:slug/activate").put(
  storeInformationController.activateStoreInformation,
);

_.route("/store-information/:slug/deactivate").put(
  storeInformationController.deactivateStoreInformation,
);

module.exports = _;
