const express = require("express");
const _ = express.Router();
const userpermissionController = require("../../controller/adduserpermission.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/get-all-permissions").get(
  authGuard,
  authorize("create-user", "view"),
  userpermissionController.getAllPermissions,
);
_.route("/get-all-users").get(
  authGuard,
  authorize("create-user", "view"),
  userpermissionController.getAllUsers,
);
_.route("/get-user-permissions/:userId").get(
  authGuard,
  authorize("create-user", "view"),
  userpermissionController.getUserPermissions,
);
_.route("/update-user-permissions/:userId").put(
  authGuard,
  authorize("create-user", "edit"),
  userpermissionController.updateUserPermissions,
);

module.exports = _;
