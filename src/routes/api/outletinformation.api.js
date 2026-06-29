const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const outletInformationController = require("../../controller/outletinformation.controller");

_.route("/create-outletinformation").post(
  authGuard,
  authorize("outlet-information", "add"),
  singleFileUpload("image"),
  outletInformationController.createOutletInformation,
);

_.route("/get-all-outletinformation").get(
  authGuard,
  authorize("outlet-information", "view"),
  outletInformationController.getAllOutletInformation,
);

_.route("/get-outletinformation/:slug").get(
  authGuard,
  authorize("outlet-information", "view"),
  outletInformationController.getOutletInformationBySlug,
);

_.route("/update-outletinformation/:slug").put(
  authGuard,
  authorize("outlet-information", "edit"),
  singleFileUpload("image"),
  outletInformationController.updateOutletInformation,
);
_.route("/delete-outletinformation/:slug").delete(
  authGuard,
  authorize("outlet-information", "delete"),
  outletInformationController.deleteOutletInformation,
);

module.exports = _;
