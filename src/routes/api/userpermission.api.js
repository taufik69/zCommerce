const express = require("express");
const _ = express.Router();
const userpermissionController = require("../../controller/adduserpermission.controller");
_.route("/get-all-permissions").get(userpermissionController.getAllPermissions);
_.route("/get-all-users").get(userpermissionController.getAllUsers);
_.route("/get-user-permissions/:userId").get(
  userpermissionController.getUserPermissions
);
_.route("/update-user-permissions/:userId").put(
  userpermissionController.updateUserPermissions
);
module.exports = _;
