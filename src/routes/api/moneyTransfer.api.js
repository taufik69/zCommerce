const express = require("express");
const _ = express.Router();
const moneyTransferController = require("../../controller/moneyTransfer.controller");

_.route("/create-moneytransfer").post(
  moneyTransferController.createMoneyTransfer
);
_.route("/all-moneytransfer").get(moneyTransferController.getAllMoneyTransfer);
_.route("/single-moneytransfer/:id").get(
  moneyTransferController.getSingleMoneyTransfer
);
_.route("/update-moneytransfer/:id").put(
  moneyTransferController.updateMoneyTransfer
);
_.route("/delete-moneytransfer/:id").delete(
  moneyTransferController.deleteMoneyTransfer
);
module.exports = _;
