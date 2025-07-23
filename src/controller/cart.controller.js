const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const Product = require("../models/product.model");
const Cart = require("../models/cart.model");
//@desc add to cart

exports.addToCart = asynchandeler(async (req, res) => {
  const userId = req?.user?._id;
  const { productId, quantity } = req.body;

  if (!quantity || quantity <= 0) {
    throw new customError(
      "Invalid quantity quantiy must be greater than 0",
      400
    );
  }

  const product = await Product.findById(productId)
    .populate({
      path: "category",
      populate: {
        path: "discount",
      },
    })
    .populate({
      path: "subcategory",
      populate: {
        path: "discount",
      },
    })
    .populate({
      path: "variant",
    })
    .populate("discount");

  if (!product) {
    throw new customError("Product not found", 404);
  }

  // calculate the price with discount percentance

  let priceWithDiscount = 0;
  let discountRateInPercent = 0;
  let discountPriceWithTk = 0;

  if (
    product?.category?.discount?.discountType.trim() ==
    "percentance".toString().trim()
  ) {
    discountRateInPercent =
      product?.category?.discount?.discountValueByPercentance ||
      product?.subcategory?.discount?.discountValueByPercentance ||
      product?.discount?.discountValueByPercentance;
    const afterDiscountPrice =
      product.retailPrice - (product.retailPrice * discountRateInPercent) / 100;

    priceWithDiscount = Math.round(afterDiscountPrice);
  } else {
    // calculate price with discount tk

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

  let cart = await Cart.findOne({
    $or: [{ user: userId }, { user: "687f69506c48eb6386dc5f6d" }],
  });
  if (!cart) {
    cart = new Cart({
      user: userId ? userId : "687f69506c48eb6386dc5f6d",
      items: [],
      totalAmountOfWholeProduct: 0,
    });
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex > -1) {
    console.log("itemIndex", itemIndex);

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
    });
  }

  cart.totalAmountOfWholeProduct = cart.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  cart.discountPrice = discountPriceWithTk;
  discountPercentance = discountRateInPercent;

  await cart.save();
  apiResponse.sendSuccess(res, 201, "Product added to cart", cart);
});

//@desc cart quantity
exports.decreaseCartQuantity = asynchandeler(async (req, res) => {
  const userId = req?.user?._id;
  const { cartId } = req.params;
  const cart = await Cart.findOne({
    $or: [
      { user: userId },
      { user: "687f69506c48eb6386dc5f6d" },
      { _id: cartId },
    ],
  });
  if (!cart) {
    throw new customError("Cart not found", 404);
  }

  if (cart.discountPrice || cart.discountPercentance) {
    if (cart.items[0].quantity > 1) {
      console.log(cart);
      cart.items[0].quantity -= 1;
      cart.items[0].totalPrice -= cart.items[0].price;
      cart.totalAmountOfWholeProduct = cart.items[0].totalPrice;
    } else {
      cart.items[0].quantity = cart.items[0].quantity;
      cart.items[0].totalPrice = cart.items[0].totalPrice;
      cart.totalAmountOfWholeProduct = cart.items[0].totalPrice;
    }
  } else {
    if (cart.items[0].quantity > 1) {
      cart.items[0].quantity -= 1;
      cart.items[0].totalPrice -= cart.items[0].reatailPrice;
      cart.totalAmountOfWholeProduct = cart.items[0].totalPrice;
    } else {
      cart.items[0].quantity = cart.items[0].quantity;
      cart.items[0].totalPrice = cart.items[0].totalPrice;
      cart.totalAmountOfWholeProduct = cart.items[0].totalPrice;
    }
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
