const express = require("express");
const _ = express.Router();
const { singleFileUpload } = require("../../middleware/multer.middleware");
const outletInformationController = require("../../controller/outletinformation.controller");

_.route("/create-outletinformation").post(
  singleFileUpload("image"),
  outletInformationController.createOutletInformation
);

_.route("/get-all-outletinformation").get(
  outletInformationController.getAllOutletInformation
);

_.route("/get-outletinformation/:slug").get(
  outletInformationController.getOutletInformationBySlug
);

_.route("/update-outletinformation/:slug").put(
  singleFileUpload("image"),
  outletInformationController.updateOutletInformation
);
_.route("/delete-outletinformation/:slug").delete(
  outletInformationController.deleteOutletInformation
);
module.exports = _;
