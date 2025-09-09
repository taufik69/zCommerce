const express = require("express");
const _ = express.Router();
const salesReturnController = require("../../controller/salesReturn.controller");

_.route("/createsalesreturn").post(salesReturnController.createSalesReturn);
_.route("/allsalesreturn").get(salesReturnController.getAllSalesReturn);
_.route("/single-salesreturn/:slug").get(
  salesReturnController.getSingleSalesReturn
);
_.route("/update-salesreturn/:slug").put(
  salesReturnController.updateSalesReturn
);
_.route("/delete-salesreturn/:slug").delete(
  salesReturnController.deleteSalesReturn
);

module.exports = _;
