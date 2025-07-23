const express = require("express");
const _ = express.Router();
const wishListController = require("../../controller/wishList.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
_.route("/add-wishtlist").post(
  //   authGuard,
  //   authorize("wishlist", "add"),
  wishListController.addToWishlist
);

_.route("/get-wishtlist").get(
  //   authGuard,
  //   authorize("wishlist", "view"),
  wishListController.getAllWishList
);

_.route("/delete-wishtlist/:slug").delete(
  //   authGuard,
  //   authorize("wishlist", "delete"),
  wishListController.deleteWishlist
);
module.exports = _;
