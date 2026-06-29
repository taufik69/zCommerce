const express = require("express");
const _ = express.Router();
const transactionController = require("../../controller/createTransition.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-transaction").post(authGuard, authorize("add-transaction", "add"), transactionController.createTransaction);
_.route("/get-alltransaction").get(authGuard, authorize("add-transaction", "view"), transactionController.getAllTransaction);
_.route("/single-transaction/:id").get(authGuard, authorize("add-transaction", "view"), transactionController.getSingleTransaction);
_.route("/update-transaction/:id").put(authGuard, authorize("add-transaction", "edit"), transactionController.updateTransaction);
_.route("/delete-transaction/:id").delete(authGuard, authorize("add-transaction", "delete"), transactionController.deleteTransaction);

module.exports = _;
