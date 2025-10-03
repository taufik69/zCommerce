const express = require("express");
const _ = express.Router();
const accountController = require("../../controller/account.controller");

_.route("/create-account").post(accountController.createAccount);
_.route("/all-account").get(accountController.getAllAccounts);
_.route("/single-account/:slug").get(accountController.getSingleAccount);
_.route("/update-account/:slug").put(accountController.updateAccount);
_.route("/delete-account/:slug").delete(accountController.deleteAccount);

module.exports = _;
