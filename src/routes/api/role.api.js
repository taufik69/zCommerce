const express = require("express");
const _ = express.Router();
const roleController = require("../../controller/role.controller");
const { authGuard } = require("../../middleware/authMiddleware");
// const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-role")
  .post(
    authGuard,
    // authorize("create-role", "add"),
    roleController.createRole
  );

_.route("/all-role")
  .get(roleController.getAllRoles);

_.route("/singlerole/:slug")
  .get(roleController.getRoleByslug);

_.route("/updaterole/:slug")
  .put(
    authGuard,
    // authorize("create-role", "edit"),
    roleController.updateRole
  );

_.route("/deleterole/:slug")
  .delete(
    authGuard,
    // authorize("create-role", "delete"),
    roleController.deleteRole
  );

_.route("/role/:slug/permissions")
  .get(roleController.getRolePermissions)
  .put(
    authGuard,
    // authorize("create-role", "edit") — omitted so superadmin always has access via authGuard alone
    roleController.assignPermissionsToRole
  );

module.exports = _;
