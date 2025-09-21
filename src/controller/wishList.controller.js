const { customError } = require("../lib/CustomError");
const WishList = require("../models/wishList.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

//@desc add to wishlist
exports.addToWishlist = asynchandeler(async (req, res) => {
  const { productId, variantId } = req.body;

  if (!productId && !variantId) {
    throw new customError("Product ID or Variant ID is required", 400);
  }

  const userId = req?.user?._id || null;
  const guestId = req?.body?.guestId || null;

  if (!userId && !guestId) {
    throw new customError("User or Guest ID is required", 400);
  }

  // Find wishlist
  const query = userId ? { user: userId } : { guestId };
  let wishlist = await WishList.findOne(query);

  // Define item object based on input
  let newItem = {};
  if (variantId) newItem.variant = variantId;
  if (productId) newItem.product = productId;

  // Create new wishlist if none exists
  if (!wishlist) {
    wishlist = await WishList.create({
      user: userId,
      guestId,
      items: [newItem],
    });
    return apiResponse.sendSuccess(res, 201, "Wishlist created", wishlist);
  }

  // Check if the item (product or variant) already exists
  const alreadyExists = wishlist.items.some((item) => {
    if (variantId) {
      return item.variant?.toString() === variantId;
    } else if (productId) {
      return item.product?.toString() === productId;
    }
    return false;
  });

  if (alreadyExists) {
    throw new customError("Item already in wishlist", 400);
  }

  // Add new item to wishlist
  wishlist.items.push(newItem);
  await wishlist.save();

  apiResponse.sendSuccess(res, 200, "Item added to wishlist", wishlist);
});

// @desc get all useList using guestid or userid and populate product
// @desc Get all wishlist items for a user or guest
exports.getAllUserWishlist = asynchandeler(async (req, res) => {
  const userId = req?.query?.userId || null;
  const guestId = req?.query?.guestId || null;

  if (!userId && !guestId) {
    throw new customError("User or Guest ID is required", 400);
  }

  const query = userId ? { user: userId } : { guestId };

  // populate both product and variant
  const wishlist = await WishList.findOne(query)
    .populate({
      path: "items.product",
      select: "productTitle productSummary retailPrice wholesalePrice image",
    })
    .populate({
      path: "items.variant",
      select: "variantName retailPrice wholesalePrice stockVariant image",
    })
    .lean();

  if (!wishlist) {
    throw new customError("Wishlist not found", 404);
  }

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
