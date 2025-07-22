const express = require("express");
const _ = express.Router();
const cartController = require("../../controller/cart.controller");

_.route("/addtocart").post(cartController.addToCart);
_.route("/decreasecart/:cartId").post(cartController.decreaseCartQuantity);

module.exports = _;
