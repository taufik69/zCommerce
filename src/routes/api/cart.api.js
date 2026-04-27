const express = require("express");
const _ = express.Router();
const cartController = require("../../controller/cart.controller");
const { guestOrAuth } = require("../../middleware/guestOrAuth");
const { authGuard } = require("../../middleware/authMiddleware");

_.route("/").get(guestOrAuth, cartController.getCartController);
_.route("/add").post(guestOrAuth, cartController.addToCartController);
_.route("/update/:itemId").patch(guestOrAuth, cartController.updateQuantityController);
_.route("/remove/:itemId").delete(guestOrAuth, cartController.removeFromCartController);
_.route("/clear").delete(guestOrAuth, cartController.clearCartController);
_.route("/merge").post(authGuard, cartController.mergeCartController);

module.exports = _;
