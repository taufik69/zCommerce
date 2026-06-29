const express = require("express");
const _ = express.Router();
const accountController = require("../../controller/account.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-account").post(authGuard, authorize("add-account", "add"), accountController.createAccount);
_.route("/all-account").get(authGuard, authorize("add-account", "view"), accountController.getAllAccounts);
_.route("/single-account/:slug").get(authGuard, authorize("add-account", "view"), accountController.getSingleAccount);
_.route("/update-account/:slug").put(authGuard, authorize("add-account", "edit"), accountController.updateAccount);
_.route("/delete-account/:slug").delete(authGuard, authorize("add-account", "delete"), accountController.deleteAccount);

module.exports = _;
