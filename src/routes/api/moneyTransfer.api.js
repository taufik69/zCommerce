const express = require("express");
const _ = express.Router();
const moneyTransferController = require("../../controller/moneyTransfer.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

_.route("/create-moneytransfer").post(authGuard, authorize("money-transfer", "add"), moneyTransferController.createMoneyTransfer);
_.route("/all-moneytransfer").get(authGuard, authorize("money-transfer", "view"), moneyTransferController.getAllMoneyTransfer);
_.route("/single-moneytransfer/:id").get(authGuard, authorize("money-transfer", "view"), moneyTransferController.getSingleMoneyTransfer);
_.route("/update-moneytransfer/:id").put(authGuard, authorize("money-transfer", "edit"), moneyTransferController.updateMoneyTransfer);
_.route("/delete-moneytransfer/:id").delete(authGuard, authorize("money-transfer", "delete"), moneyTransferController.deleteMoneyTransfer);

module.exports = _;
