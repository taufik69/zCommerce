const express = require("express");
const _ = express.Router();
const dashboardController = require("../../controller/dashboard.controller");
// const { authGuard } = require("../../middleware/authMiddleware");
// const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/overview").get(
  // authGuard,
  // authorize("dashboard", "view"),
  dashboardController.getOverview,
);

module.exports = _;
