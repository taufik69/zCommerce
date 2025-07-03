const express = require("express");
const _ = express.Router();
const Permission = require("../../controller/permission.controller");

_.route("/addpermission").post(Permission.createPermission);
_.route("/allpermissions").get(Permission.getAllPermissions);
_.route("/permission/:slug").get(Permission.getPermissionBySlug);
_.route("/permission-update/:slug").put(Permission.updatePermission);
_.route("/permission-deactive/:slug").put(Permission.deactivatePermission);
_.route("/permission-active/:slug").put(Permission.activePermission);
_.route("/delete-permission/:slug").delete(Permission.deletePermission);

module.exports = _;
