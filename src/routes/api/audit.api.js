const express = require("express");
const _ = express.Router();
const Audit = require("../../controller/audit.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/").get(authGuard, authorize("audit-log", "view"), Audit.getAuditLogs);

_.route("/entity/:type/:id").get(
  authGuard,
  authorize("audit-log", "view"),
  Audit.getEntityTimeline,
);

module.exports = _;
