const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Cart = require("../models/cart.model");

//@desc add to cart
exports.addToCart = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || req.body.user || null;
  const guestId = req?.body?.guestId || null;

  const { productId, variantId, quantity, color, size } = req.body;

  if (!quantity || quantity <= 0) {
    throw new customError(
      "Invalid quantity: quantity must be greater than 0",
      400
    );
  }
  if (!userId && !guestId) {
    throw new customError("User or guest ID is required", 400);
  }

  let product = null;
  let variant = null;
  let price = 0;

  // Product fetch
  if (productId) {
    product = await Product.findById(productId);
    if (!product) throw new customError("Product not found", 404);
    price = product.retailPrice;
  }

  // Variant fetch
  if (variantId) {
    variant = await Variant.findById(variantId);
    if (!variant) throw new customError("Variant not found", 404);
    price = variant.retailPrice;
    // যদি variant এর সাথে product reference থাকে, চাইলে এখানে product-ও populate করতে পারেন
    if (!product && variant.product) {
      product = await Product.findById(variant.product);
    }
  }

  // Cart খুঁজুন
  const cartQuery = userId ? { user: userId } : { guestId };
  let cart = await Cart.findOne(cartQuery);

  // Cart না থাকলে নতুন cart তৈরি করুন
  if (!cart) {
    cart = new Cart({
      user: userId || null,
      guestId: guestId || null,
      items: [],
    });
  }

  // Cart item খুঁজুন (productId বা variantId দিয়ে)
  let itemIndex = -1;
  if (variantId) {
    itemIndex = cart.items.findIndex(
      (item) => item.variant && item.variant.toString() === variantId
    );
  } else if (productId) {
    itemIndex = cart.items.findIndex(
      (item) => item.product && item.product.toString() === productId
    );
  }

  // Item থাকলে quantity বাড়ান, না থাকলে নতুন item push করুন
  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].price = price;
    cart.items[itemIndex].totalPrice = Math.round(
      cart.items[itemIndex].quantity * price
    );
    if (color) cart.items[itemIndex].color = color;
    if (size) cart.items[itemIndex].size = size;
  } else {
    cart.items.push({
      product: product ? product._id : null,
      variant: variant ? variant._id : null,
      quantity: quantity,
      price: price,
      totalPrice: Math.round(price * quantity),
      color,
      size,
    });
  }

  await cart.save();
  apiResponse.sendSuccess(res, 201, "Product added to cart", cart);
});

//@desc cart quantity
exports.decreaseCartQuantity = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || req.body.user || null;
  const guestId = req?.body?.guestId || null;
  const { cartId } = req.params;
  const { productId, variantId } = req.body;

  if (!productId && !variantId) {
    throw new customError("Product ID or Variant ID is required", 400);
  }

  // Find the cart using either user, guestId, or cartId
  const cart = await Cart.findOne({
    user: userId,
    guestId: guestId,
  });

  if (!cart) {
    throw new customError("Cart not found", 404);
  }

  // Cart item খুঁজুন (variantId থাকলে সেটি, না থাকলে productId)
  let itemIndex = -1;
  if (variantId) {
    itemIndex = cart.items.findIndex(
      (item) => item.variant && item.variant.toString() === variantId
    );
  } else if (productId) {
    itemIndex = cart.items.findIndex(
      (item) => item.product && item.product.toString() === productId
    );
  }

  if (itemIndex === -1) {
    throw new customError("Product/Variant not found in cart", 404);
  }

  const item = cart.items[itemIndex];
  const unitPrice = item.price || item.retailPrice || 0;

  if (item.quantity > 1) {
    item.quantity -= 1;
    item.totalPrice = item.quantity * unitPrice;
  } else {
    throw new customError(
      "Minimum quantity is 1. Cannot decrement further.",
      400
    );
  }

  await cart.save();

  apiResponse.sendSuccess(
    res,
    200,
    "Cart quantity decreased successfully",
    cart
  );
});

//@desc Delete Cart
exports.deleteCart = asynchandeler(async (req, res) => {
  const { cartId } = req.params;
  const { cartItemId } = req.body;
  if (!cartId || !cartItemId) {
    throw new customError("Cart ID or Cart Item ID is required", 400);
  }

  const cart = await Cart.findOne({ _id: cartId });
  if (!cart) throw new customError("Cart not found with this ID", 404);
  cart.items.map((item) =>
    item._id == cartItemId ? cart.items.pull(item) : null
  );
  await cart.save();

  if (!cart) {
    throw new customError("Cart not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Cart deleted successfully", cart);
});

//@desc get all cart list using userid or guestid
exports.getAllCart = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || null;
  const guestId = req?.body?.guestId || null;
  const query = userId ? { user: userId } : { guestId };
  const cart = await Cart.findOne(query).populate("items.product").lean();
  if (!cart) throw new customError("Cart not found", 404);
  apiResponse.sendSuccess(res, 200, "Cart fetched successfully", cart);
});
exports.getCartByUserId = asynchandeler(async (req, res) => {
  const { id } = req.params;
  // Try finding by user first, then guest
  let cart = await Cart.findOne({ user: id }).populate("items.product");
  if (!cart) {
    cart = await Cart.findOne({ guestId: id }).populate("items.product");
  }
  if (!cart) throw new customError("Cart not found", 404);
  apiResponse.sendSuccess(res, 200, "Cart fetched successfully", cart);
});
