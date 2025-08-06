const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const DeliverCharge = require("../models/delivery.model");
const { v4: uuidv4 } = require("uuid");
const SSLCommerzPayment = require("sslcommerz-lts");
const cartModel = require("../models/cart.model");

// applyDeliveryCharge
const applyDeliveryCharge = async (deliveryChargeID) => {
  if (!deliveryChargeID) return 0;
  const dlc = await DeliverCharge.findById({ _id: "6891ca2e9e4264e8bce16938" });
  console.log("====================================");
  console.log(dlc);
  console.log("====================================");
  // return deliveryCharge.deliveryCharge;
};
// Coupon utility
const applyCouponDiscount = async (code, subtotal) => {
  if (!code)
    return { discountedAmount: subtotal, discountAmount: 0, coupon: null };

  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) throw new customError("Invalid or expired coupon", 400);

  const now = new Date();
  if (coupon.expiry && now > coupon.expiry)
    throw new customError("Coupon expired", 400);

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    throw new customError("Coupon usage limit exceeded", 400);

  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (subtotal * coupon.discountValue) / 100;
  } else if (coupon.discountType === "fixed") {
    discountAmount = coupon.discountValue;
  }

  const discountedAmount = Math.round(subtotal - discountAmount);
  // incrase the coupon usage count
  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

  return { discountedAmount, discountAmount, coupon };
};

// Main controller
exports.createOrder = asynchandeler(async (req, res) => {
  const userId = req.user?._id;
  const { items, shippingInfo, paymentMethod, couponCode, deliveryCharge } =
    req.body;

  if (!items || items.length === 0) {
    throw new customError("No order items provided", 400);
  }

  // Step 1: Calculate subtotal
  let totalPriceofProducts = 0;
  const productUpdatePromises = [];

  const cartItems = await cartModel.findOne({
    user: userId || null,
    guestId: req.body.guestId || null,
  });

  if (!cartItems) {
    throw new customError("Cart not found", 404);
  }
  for (const item of cartItems.items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new customError(`Product not found`, 404);
    }

    totalPriceofProducts += item.totalPrice;
    // decrease product stock
    productUpdatePromises.push(
      Product.updateOne(
        { _id: item.product },
        { $inc: { stock: -item.quantity } }
      )
    );
  }
  await Promise.all(productUpdatePromises);

  if (totalPriceofProducts <= 0) {
    throw new customError("No products in the cart", 400);
  }

  // Step 2: Apply coupon
  const { discountedAmount, discountAmount, coupon, couponId } =
    await applyCouponDiscount(couponCode, totalPriceofProducts);

  // Step 3: Calculate delivery charge
  const deliveryChargeAmount = await applyDeliveryCharge(deliveryCharge);
  // console.log("====================================");
  // console.log(deliveryChargeAmount);
  // console.log("====================================");
  return;
  // Step 4: Final amount calculation (no delivery charge)
  const finalAmount = discountedAmount + deliveryChargeAmount;

  // Step 5: Generate invoice ID
  const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

  // Step 6: Create order
  const order = await Order.create({
    user: userId || null,
    guestId: req.body.guestId || null,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
    })),
    shippingInfo,
    totalAmount: totalPriceofProducts,
    discountAmount,
    finalAmount,
    deliveryCharge: deliveryChargeAmount,
    paymentMethod,
    invoiceId,
    paymentStatus: paymentMethod === "cod" ? "unpaid" : "pending",
    orderStatus: "pending",
    coupon: coupon ? coupon._id : undefined,
  });

  // Step 7: Update stock
  await Promise.all(productUpdatePromises);

  // Step 8: Handle SSLCommerz
  if (paymentMethod === "sslcommerz") {
    const data = {
      total_amount: finalAmount,
      currency: "BDT",
      tran_id: invoiceId,
      success_url: `https://yourdomain.com/api/payment/success/${order._id}`,
      fail_url: `https://yourdomain.com/api/payment/fail/${order._id}`,
      cancel_url: `https://yourdomain.com/api/payment/cancel/${order._id}`,
      ipn_url: `https://yourdomain.com/api/payment/ipn/${order._id}`,
      shipping_method: "Courier",
      product_name: "Ordered Products",
      product_category: "Ecommerce",
      product_profile: "general",
      cus_name: shippingInfo.name,
      cus_email: shippingInfo.email || "demo@email.com",
      cus_add1: shippingInfo.address,
      cus_phone: shippingInfo.phone,
      ship_name: shippingInfo.name,
      ship_add1: shippingInfo.address,
      ship_city: shippingInfo.city || "Dhaka",
      ship_country: "Bangladesh",
    };

    const sslcz = new SSLCommerzPayment(
      process.env.SSLC_STORE_ID,
      process.env.SSLC_STORE_PASSWORD,
      false
    );
    const sslRes = await sslcz.init(data);
    if (sslRes.status === "FAILED") {
      throw new customError(sslRes.status, 400);
    }

    apiResponse.sendSuccess(
      res,
      201,
      "Order placed successfully (SSLCommerz)",
      {
        redirectUrl: sslRes.GatewayPageURL,
      }
    );
  }

  // Step 9: Response for COD
  res.status(201).json(
    apiResponse(true, {
      message: "Order placed successfully (COD)",
      order,
    })
  );
});
