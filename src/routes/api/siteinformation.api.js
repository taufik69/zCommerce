const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const siteInformationController = require("../../controller/siteinformation.controller");

_.route("/create-siteinformation").post(
  // authGuard,
  // authorize("siteinformation", "add"),
  singleFileUpload("image"),
  siteInformationController.createSiteInformation,
);

_.route("/get-siteinformation").get(
  // authGuard,
  // authorize("siteinformation", "view"),
  siteInformationController.getAllSiteInformation,
);

_.route("/single-siteinformation/:slug").get(
  // authGuard,
  // authorize("siteinformation", "view"),
  siteInformationController.getSingleSiteInformation,
);

_.route("/update-siteinformation/:slug").put(
  // authGuard,
  // authorize("siteinformation", "edit"),
  singleFileUpload("image"),
  siteInformationController.updateSiteInformation,
);

_.route("/delete-siteinformation/:slug").delete(
  // authGuard,
  // authorize("siteinformation", "delete"),
  siteInformationController.deleteSiteInformation,
);

module.exports = _;
