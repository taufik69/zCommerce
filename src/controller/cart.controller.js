const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Cart = require("../models/cart.model");

//@desc add to cart
exports.addToCart = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || req.body.user || null;
  const guestId = req?.body?.guestId || null;

  const { productId, quantity, color, size } = req.body;

  if (!quantity || quantity <= 0) {
    throw new customError(
      "Invalid quantity: quantity must be greater than 0",
      400
    );
  }

  if (!userId && !guestId) {
    throw new customError("User or guest ID is required", 400);
  }

  const product = await Product.findById(productId)
    .populate({
      path: "category",
      populate: { path: "discount" },
    })
    .populate({
      path: "subcategory",
      populate: { path: "discount" },
    })
    .populate("variant")
    .populate("discount");

  if (!product) {
    throw new customError("Product not found", 404);
  }

  // calculate the price with discount
  let priceWithDiscount = 0;
  let discountRateInPercent = 0;
  let discountPriceWithTk = 0;

  if (product?.category?.discount?.discountType?.trim() === "percentance") {
    discountRateInPercent =
      product?.category?.discount?.discountValueByPercentance ||
      product?.subcategory?.discount?.discountValueByPercentance ||
      product?.discount?.discountValueByPercentance;

    const afterDiscountPrice =
      product.retailPrice - (product.retailPrice * discountRateInPercent) / 100;

    priceWithDiscount = Math.round(afterDiscountPrice);
  } else {
    discountPriceWithTk =
      product?.category?.discount?.discountValueByAmount ||
      product?.subcategory?.discount?.discountValueByAmount ||
      product?.discount?.discountValueByAmount;

    const DiscountPrice = product.retailPrice - discountPriceWithTk;
    priceWithDiscount = Math.round(DiscountPrice);
  }

  if (priceWithDiscount < 0) {
    priceWithDiscount = 0;
  }

  const price = priceWithDiscount || product.retailPrice;

  // ✅ Find cart using user or guestId
  const cartQuery = userId ? { user: userId } : { guestId };
  let cart = await Cart.findOne(cartQuery);

  if (!cart) {
    cart = new Cart({
      user: userId || null,
      guestId: guestId || null,
      items: [
        {
          product: product._id,
          quantity: quantity,
          price: price,
          reatailPrice: product.retailPrice,
          totalPrice: Math.round(price * quantity),
          color,
          size,
        },
      ],

      totalAmountOfWholeProduct: 0,
    });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].price = price;
    cart.items[itemIndex].totalPrice = Math.round(
      cart.items[itemIndex].quantity * price
    );
  } else {
    cart.items.push({
      product: product._id,
      quantity: quantity,
      price: price,
      reatailPrice: product.retailPrice,
      totalPrice: Math.round(price * quantity),
      color,
      size,
    });
  }

  cart.totalAmountOfWholeProduct = cart.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  cart.discountPrice = discountPriceWithTk;
  cart.discountPercentance = discountRateInPercent;

  await cart.save();
  apiResponse.sendSuccess(res, 201, "Product added to cart", cart);
});

//@desc cart quantity
exports.decreaseCartQuantity = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || null;
  const guestId = req?.body?.guestId || null;
  const { cartId } = req.params;
  const { productId } = req.body;

  if (!productId) {
    throw new customError("Product ID is required", 400);
  }

  // Find the cart using either user, guestId, or cartId
  const cart = await Cart.findOne({
    $or: [{ user: userId }, { guestId: guestId }, { _id: cartId }],
  });

  if (!cart) {
    throw new customError("Cart not found", 404);
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex === -1) {
    throw new customError("Product not found in cart", 404);
  }

  const item = cart.items[itemIndex];

  // Handle discount or regular price
  const unitPrice = item.price || item.reatailPrice || 0;

  if (item.quantity > 1) {
    item.quantity -= 1;
    item.totalPrice = item.quantity * unitPrice;
  } else {
    // Optional: remove item if quantity is 1
    cart.items.splice(itemIndex, 1);
  }

  // Recalculate total amount
  cart.totalAmountOfWholeProduct = cart.items.reduce(
    (sum, i) => sum + i.totalPrice,
    0
  );

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
  const userId = req?.user?._id;
  const { cartId } = req.params;
  const cart = await Cart.findOneAndDelete({
    $or: [
      { user: userId },
      { user: "687f69506c48eb6386dc5f6d" },
      { _id: cartId },
    ],
  });
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
