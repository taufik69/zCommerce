const { customError } = require("../lib/CustomError");
const WishList = require("../models/wishList.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

//@desc add to wishlist
exports.addToWishlist = asynchandeler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    throw new customError("Product ID is required", 400);
  }

  const userId = req?.user?._id || null;
  const guestId = req?.body?.guestId || null;

  if (!userId && !guestId) {
    throw new customError("User or Guest ID is required", 400);
  }

  // Find wishlist based on user or guest
  const query = userId ? { user: userId } : { guestId };
  let wishlist = await WishList.findOne(query);

  // Create new wishlist if not exists
  if (!wishlist) {
    wishlist = await WishList.create({
      user: userId,
      guestId,
      items: [{ product: productId }],
    });
    return apiResponse.sendSuccess(res, 201, "Wishlist created", wishlist);
  }

  // Check if product already exists
  const alreadyExists = wishlist.items.some(
    (item) => item.product.toString() === productId
  );

  if (alreadyExists) {
    throw new customError("Product already in wishlist", 400);
  }

  // Add product to existing wishlist
  wishlist.items.push({ product: productId });
  await wishlist.save();

  apiResponse.sendSuccess(res, 200, "Product added to wishlist", wishlist);
});

// @desc get all useList using guestid or userid and populate product
exports.getAllWishList = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || null;
  const guestId = req?.query?.guestId || null;
  const query = userId ? { user: userId } : { guestId };
  const wishlist = await WishList.findOne(query)
    .populate("items.product")
    .lean();
  if (!wishlist) throw new customError("Wishlist not found", 404);
  apiResponse.sendSuccess(res, 200, "Wishlist fetched successfully", wishlist);
});

//@desc delete wishlist  by guest id or  userId
exports.deleteWishlist = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || null;
  const guestId = req?.body?.guestId || null;
  const query = userId ? { user: userId } : { guestId };
  const wishlist = await WishList.findOneAndDelete(query);
  if (!wishlist) throw new customError("Wishlist not found", 404);
  apiResponse.sendSuccess(res, 200, "Wishlist deleted successfully", wishlist);
});
