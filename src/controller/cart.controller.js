const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { getSnapshotPrice } = require("../utils/cartHelpers");
const { statusCodes } = require("../constant/constant");

// 1. getCartController
exports.getCartController = asynchandeler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const guestId = req.guestId || null;

  const query = userId ? { user: userId } : { guestId };
  
  let cart = await Cart.findOne(query)
    .populate("items.product", "name retailPrice isActive")
    .populate("items.variant", "variantName retailPrice isActive attributes");

  if (!cart) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Cart is empty", { items: [] });
  }

  // Check for price changes and remove inactive items
  let hasChanges = false;
  
  cart.items = cart.items.filter(item => {
    // If product is inactive or variant is inactive, remove item
    if (!item.product || !item.product.isActive) {
      hasChanges = true;
      return false; // remove
    }
    if (item.variant && !item.variant.isActive) {
      hasChanges = true;
      return false; // remove
    }
    
    // Check price changes
    const currentPrice = item.variant ? item.variant.retailPrice : item.product.retailPrice;
    if (currentPrice !== item.snapshotPrice) {
      item.priceChanged = true;
      item.currentPrice = currentPrice;
    } else {
      item.priceChanged = false;
    }
    
    return true; // keep
  });

  if (hasChanges) {
    await cart.save(); // pre-save will auto-calculate subTotal
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Cart fetched successfully", cart);
});

// 2. addToCartController
exports.addToCartController = asynchandeler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const guestId = req.guestId || null;
  const { productId, variantId, quantity = 1 } = req.body;

  if (quantity < 1) {
    throw new customError("Quantity must be at least 1", statusCodes.BAD_REQUEST);
  }

  const { snapshotPrice, stock } = await getSnapshotPrice(productId, variantId);

  if (stock < quantity) {
    throw new customError("Insufficient stock", statusCodes.BAD_REQUEST);
  }

  const query = userId ? { user: userId } : { guestId };
  let cart = await Cart.findOne(query);

  if (!cart) {
    cart = new Cart({
      user: userId,
      guestId: userId ? null : guestId,
      items: [],
      expiresAt: userId ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days for guest
    });
  } else if (!userId) {
    // extend expiration for guest on activity
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  // Check if same product+variant exists
  const existingItemIndex = cart.items.findIndex(item => 
    item.product.toString() === productId && 
    (variantId ? item.variant && item.variant.toString() === variantId : !item.variant)
  );

  if (existingItemIndex > -1) {
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    if (stock < newQuantity) {
      throw new customError(`Insufficient stock. Only ${stock} available.`, statusCodes.BAD_REQUEST);
    }
    cart.items[existingItemIndex].quantity = newQuantity;
    // Update item total based on current snapshot price (maybe snapshot price changed)
    cart.items[existingItemIndex].snapshotPrice = snapshotPrice;
    cart.items[existingItemIndex].itemTotal = newQuantity * snapshotPrice;
  } else {
    cart.items.push({
      product: productId,
      variant: variantId || null,
      quantity,
      snapshotPrice,
      itemTotal: snapshotPrice * quantity
    });
  }

  await cart.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Added to cart", cart);
});

// 3. updateQuantityController
exports.updateQuantityController = asynchandeler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const guestId = req.guestId || null;
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    throw new customError("Quantity must be at least 1", statusCodes.BAD_REQUEST);
  }

  const query = userId ? { user: userId } : { guestId };
  const cart = await Cart.findOne(query);

  if (!cart) {
    throw new customError("Cart not found", statusCodes.NOT_FOUND);
  }

  const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
  if (itemIndex === -1) {
    throw new customError("Item not found in cart", statusCodes.NOT_FOUND);
  }

  const item = cart.items[itemIndex];
  const { stock } = await getSnapshotPrice(item.product.toString(), item.variant ? item.variant.toString() : null);

  if (stock < quantity) {
    throw new customError(`Insufficient stock. Only ${stock} available.`, statusCodes.BAD_REQUEST);
  }

  cart.items[itemIndex].quantity = quantity;
  cart.items[itemIndex].itemTotal = quantity * cart.items[itemIndex].snapshotPrice;

  if (!userId) {
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  await cart.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Cart quantity updated", cart);
});

// 4. removeFromCartController
exports.removeFromCartController = asynchandeler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const guestId = req.guestId || null;
  const { itemId } = req.params;

  const query = userId ? { user: userId } : { guestId };
  const cart = await Cart.findOne(query);

  if (!cart) {
    throw new customError("Cart not found", statusCodes.NOT_FOUND);
  }

  cart.items.pull({ _id: itemId });

  if (!userId) {
    cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  await cart.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Item removed from cart", cart);
});

// 5. clearCartController
exports.clearCartController = asynchandeler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const guestId = req.guestId || null;

  const query = userId ? { user: userId } : { guestId };
  const cart = await Cart.findOne(query);

  if (!cart) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "Cart already clear");
  }

  cart.items = [];
  await cart.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Cart cleared successfully", cart);
});

// 6. mergeCartController
exports.mergeCartController = asynchandeler(async (req, res) => {
  const userId = req.user._id; // must be auth
  const { guestId } = req.body;

  if (!guestId) {
    throw new customError("Guest ID required for merge", statusCodes.BAD_REQUEST);
  }

  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || guestCart.items.length === 0) {
    return apiResponse.sendSuccess(res, statusCodes.OK, "No guest cart to merge");
  }

  let userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    // Convert guest cart to user cart
    guestCart.user = userId;
    guestCart.guestId = null;
    guestCart.expiresAt = null;
    await guestCart.save();
    return apiResponse.sendSuccess(res, statusCodes.OK, "Cart merged successfully", guestCart);
  }

  // Merge items
  for (const gItem of guestCart.items) {
    const uItemIndex = userCart.items.findIndex(uItem => 
      uItem.product.toString() === gItem.product.toString() && 
      (uItem.variant ? uItem.variant.toString() === (gItem.variant ? gItem.variant.toString() : null) : !gItem.variant)
    );

    if (uItemIndex > -1) {
      // Assuming no stock limit check on merge, or just adding them together.
      // A strict implementation would re-verify stock here.
      userCart.items[uItemIndex].quantity += gItem.quantity;
      userCart.items[uItemIndex].itemTotal = userCart.items[uItemIndex].quantity * userCart.items[uItemIndex].snapshotPrice;
    } else {
      userCart.items.push(gItem);
    }
  }

  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Cart merged successfully", userCart);
});
