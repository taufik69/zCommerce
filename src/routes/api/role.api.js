const express = require("express");
const _ = express.Router();
const roleController = require("../../controller/role.controller");

_.post("/create-role", roleController.createRole);
_.get("/all-role", roleController.getAllRoles);
_.get("/singlerole/:slug", roleController.getRoleByslug);

module.exports = _;
