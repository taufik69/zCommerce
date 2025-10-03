const express = require("express");
const _ = express.Router();
const fundhandoverController = require("../../controller/fundhandover.controller");
_.route("/create-fundhandover").post(fundhandoverController.createFundHandover);

_.route("/getall-fundhandover").get(fundhandoverController.getAllFundHandovers);
_.route("/single-fundhandover/:id").get(
  fundhandoverController.getFundHandoverById
);
_.route("/update-fundhandover/:id").put(
  fundhandoverController.updateFundHandover
);
_.route("/delete-fundhandover/:id").delete(
  fundhandoverController.deleteFundHandover
);

module.exports = _;
