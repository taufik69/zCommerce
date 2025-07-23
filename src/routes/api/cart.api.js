const express = require("express");
const _ = express.Router();
const cartController = require("../../controller/cart.controller");

_.route("/addtocart").post(cartController.addToCart);
_.route("/decreasecart/:cartId").post(cartController.decreaseCartQuantity);
_.route("/delete-cart/:cartId").delete(cartController.deleteCart);
_.route("/allcarts").get(cartController.getAllCart);

module.exports = _;
