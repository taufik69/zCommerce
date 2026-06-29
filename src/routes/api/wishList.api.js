const express = require("express");
const _ = express.Router();
const wishListController = require("../../controller/wishList.controller");
const { authGuard } = require("../../middleware/authMiddleware");

_.route("/add-wishtlist").post(
  authGuard,
  wishListController.addToWishlist,
);

_.route("/get-wishtlist").get(
  authGuard,
  wishListController.getAllUserWishlist,
);

_.route("/delete-wishtlist").delete(
  authGuard,
  wishListController.deleteWishlistItem,
);

module.exports = _;
