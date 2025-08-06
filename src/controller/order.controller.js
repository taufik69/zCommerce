const Order = require("../models/order.model");
const DeliveryCharge = require("../models/delivery.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { v4: uuidv4 } = require("uuid");
const SSLCommerzPayment = require("sslcommerz-lts");
const cartModel = require("../models/cart.model");

// applyDeliveryCharge
const applyDeliveryCharge = async (deliveryChargeID) => {
  if (!deliveryChargeID) return 0;
  const dlc = await DeliveryCharge.findOne({ _id: deliveryChargeID });
  return dlc;
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
  const { shippingInfo, paymentMethod, couponCode, deliveryCharge } = req.body;

  // Step 1: Load Cart
  const cart = await cartModel.findOne({
    user: userId || null,
    guestId: req.body.guestId || null,
  });
  console.log("====================================");
  console.log("cart", cart);
  console.log("====================================");
  return;
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new customError("No items in the cart", 400);
  }

  // Step 2: Calculate subtotal & reduce stock
  let totalPriceofProducts = 0;
  const productUpdatePromises = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (!product) throw new customError(`Product not found`, 404);

    if (product.stock < item.quantity) {
      throw new customError(
        `${product.productTitle} does not have enough stock`,
        400
      );
    }

    totalPriceofProducts += item.totalPrice;

    productUpdatePromises.push(
      Product.updateOne(
        { _id: item.product },
        { $inc: { stock: -item.quantity } }
      )
    );
  }

  await Promise.all(productUpdatePromises);

  // Step 3: Apply Coupon
  const { discountedAmount, discountAmount, coupon, couponId } =
    await applyCouponDiscount(couponCode, totalPriceofProducts);

  // Step 4: Delivery Charge
  const deliveryChargeAmount = await applyDeliveryCharge(deliveryCharge);
  if (!deliveryChargeAmount)
    throw new customError("Invalid delivery type", 400);

  // Step 5: Final Total
  const finalAmount = discountedAmount + deliveryChargeAmount.deliveryCharge;

  // Step 6: Invoice
  const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

  // Step 7: Create Order
  const order = await Order.create({
    user: userId || null,
    guestId: req.body.guestId || null,
    items: cart.items,
    shippingInfo,
    totalAmount: totalPriceofProducts,
    discountAmount,
    finalAmount,
    deliveryCharge: deliveryChargeAmount._id,
    paymentMethod,
    invoiceId,
    paymentStatus: paymentMethod === "cod" ? "unpaid" : "pending",
    orderStatus: "pending",
    coupon: coupon ? coupon._id : undefined,
  });

  // Step 8: Clear cart (optional)
  await cartModel.deleteOne({
    user: userId || null,
    guestId: req.body.guestId || null,
  });

  // Step 9: SSLCommerz (if needed)
  // if (paymentMethod === "sslcommerz") {
  //   const data = {
  //     total_amount: finalAmount,
  //     currency: "BDT",
  //     tran_id: invoiceId,
  //     success_url: `https://yourdomain.com/api/payment/success/${order._id}`,
  //     fail_url: `https://yourdomain.com/api/payment/fail/${order._id}`,
  //     cancel_url: `https://yourdomain.com/api/payment/cancel/${order._id}`,
  //     ipn_url: `https://yourdomain.com/api/payment/ipn/${order._id}`,
  //     shipping_method: "Courier",
  //     product_name: "Ordered Products",
  //     product_category: "Ecommerce",
  //     product_profile: "general",
  //     cus_name: shippingInfo.fullName,
  //     cus_email: shippingInfo.email || "demo@email.com",
  //     cus_add1: shippingInfo.address,
  //     cus_phone: shippingInfo.phone,
  //     ship_name: shippingInfo.fullName,
  //     ship_add1: shippingInfo.address,
  //     ship_city: shippingInfo.city || "Dhaka",
  //     ship_country: "Bangladesh",
  //   };

  //   const sslcz = new SSLCommerzPayment(
  //     process.env.SSLC_STORE_ID,
  //     process.env.SSLC_STORE_PASSWORD,
  //     false
  //   );
  //   const sslRes = await sslcz.init(data);
  //   if (sslRes.status === "FAILED") {
  //     throw new customError("SSLCommerz failed", 400);
  //   }

  //   return res.status(201).json(
  //     apiResponse(true, {
  //       message: "Order placed successfully (SSLCommerz)",
  //       redirectUrl: sslRes.GatewayPageURL,
  //     })
  //   );
  // }

  // Step 10: COD Success
  res.status(201).json(
    apiResponse(true, {
      message: "Order placed successfully (COD)",
      order,
    })
  );
});
