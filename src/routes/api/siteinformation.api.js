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
  siteInformationController.createSiteInformation
);

// @desc   categories routes
_.route("/get-siteinformation").get(
  // authGuard,
  // authorize("category", "add"),
  siteInformationController.getAllSiteInformation
);

_.route("/single-siteinformation/:slug").get(
  // authGuard,
  // authorize("siteinformation", "update"),
  siteInformationController.getSingleSiteInformation
);

_.route("/update-siteinformation/:slug").put(
  // authGuard,
  // authorize("siteinformation", "update"),
  singleFileUpload("image"),
  siteInformationController.updateSiteInformationWithImage
);

_.route("/delete-siteinformation/:slug").delete(
  // authGuard,
  // authorize("siteinformation", "delete"),
  siteInformationController.deleteSiteInformation
);
module.exports = _;
