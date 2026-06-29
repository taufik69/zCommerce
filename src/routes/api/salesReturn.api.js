const express = require("express");
const _ = express.Router();
const salesReturnController = require("../../controller/salesReturn.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/createsalesreturn").post(authGuard, authorize("retail-sales", "add"), salesReturnController.createSalesReturn);
_.route("/allsalesreturn").get(authGuard, authorize("retail-sales", "view"), salesReturnController.getAllSalesReturn);
_.route("/single-salesreturn/:slug").get(authGuard, authorize("retail-sales", "view"), salesReturnController.getSingleSalesReturn);
_.route("/update-salesreturn/:slug").put(authGuard, authorize("retail-sales", "edit"), salesReturnController.updateSalesReturn);
_.route("/delete-salesreturn/:slug").delete(authGuard, authorize("retail-sales", "delete"), salesReturnController.deleteSalesReturn);

module.exports = _;
