const express = require("express");
const _ = express.Router();
const Permission = require("../../controller/permission.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/addpermission").post(
  authGuard,
  authorize("create-permission", "add"),
  Permission.createPermission,
);
_.route("/allpermissions").get(
  authGuard,
  authorize("create-permission", "view"),
  Permission.getAllPermissions,
);
_.route("/permission/:slug").get(
  authGuard,
  authorize("create-permission", "view"),
  Permission.getPermissionBySlug,
);
_.route("/permission-update/:slug").put(
  authGuard,
  authorize("create-permission", "edit"),
  Permission.updatePermission,
);
_.route("/permission-deactive/:slug").put(
  authGuard,
  authorize("create-permission", "edit"),
  Permission.deactivatePermission,
);
_.route("/permission-active/:slug").put(
  authGuard,
  authorize("create-permission", "edit"),
  Permission.activePermission,
);
_.route("/delete-permission/:slug").delete(
  authGuard,
  authorize("create-permission", "delete"),
  Permission.deletePermission,
);

module.exports = _;
