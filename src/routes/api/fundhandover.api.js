const express = require("express");
const _ = express.Router();
const fundhandoverController = require("../../controller/fundhandover.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-fundhandover").post(authGuard, authorize("money-handover", "add"), fundhandoverController.createFundHandover);
_.route("/getall-fundhandover").get(authGuard, authorize("money-handover", "view"), fundhandoverController.getAllFundHandovers);
_.route("/single-fundhandover/:id").get(authGuard, authorize("money-handover", "view"), fundhandoverController.getFundHandoverById);
_.route("/update-fundhandover/:id").put(authGuard, authorize("money-handover", "edit"), fundhandoverController.updateFundHandover);
_.route("/delete-fundhandover/:id").delete(authGuard, authorize("money-handover", "delete"), fundhandoverController.deleteFundHandover);

module.exports = _;
