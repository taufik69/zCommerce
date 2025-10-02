const express = require("express");
const _ = express.Router();
const transactionController = require("../../controller/createTransition.controller");

_.route("/create-transaction").post(transactionController.createTransaction);
_.route("/get-alltransaction").get(transactionController.getAllTransaction);
_.route("/single-transaction/:id").get(
  transactionController.getSingleTransaction
);

_.route("/update-transaction/:id").put(transactionController.updateTransaction);
_.route("/delete-transaction/:id").delete(
  transactionController.deleteTransaction
);

module.exports = _;
