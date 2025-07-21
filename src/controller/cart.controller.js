const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Cart = require("../models/cart.model");
//@desc add to cart

exports.addToCart = asynchandeler(async (req, res) => {
  const userId = req?.user?._id || "guest";
  const { productId, quantity } = req.body;

  if (!quantity || quantity <= 0) {
    throw new customError(
      "Invalid quantity quantiy must be greater than 0",
      400
    );
  }

  const product = await Product.findById(productId)
  if (!product) {
    throw new customError("Product not found", 404);
  }

  const price = product.discountPrice || product.retailPrice || product.price;
  console.log(product);

  return;

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({
      user: userId,
      items: [],
      totalAmountOfWholeProduct: 0,
    });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].price = price;
    cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * price;
  } else {
    cart.items.push({
      product: product._id,
      quantity: quantity,
      price: price,
      totalPrice: quantity * price,
    });
  }

  cart.totalAmountOfWholeProduct = cart.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  cart.coupon = null;
  cart.discount = 0;

  await cart.save();
  res.status(200).json({ success: true, cart });
});
