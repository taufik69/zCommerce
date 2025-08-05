const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { v4: uuidv4 } = require("uuid");
const SSLCommerzPayment = require("sslcommerz-lts");

// Config
const deliveryChargeMap = {
  inside_dhaka: 60,
  outside_dhaka: 120,
  sub_area: 100,
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

  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (subtotal * coupon.discountValue) / 100;
  } else if (coupon.discountType === "fixed") {
    discountAmount = coupon.discountValue;
  }

  if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
    discountAmount = coupon.maxDiscount;
  }

  const discountedAmount = subtotal - discountAmount;

  return { discountedAmount, discountAmount, coupon };
};

// Main controller
exports.createOrder = asynchandeler(async (req, res) => {
  const userId = req.user?._id;
  const { items, shippingInfo, paymentMethod, couponCode } = req.body;

  if (!items || items.length === 0) {
    throw new customError("No order items provided", 400);
  }

  // Step 1: Calculate subtotal
  let totalPriceofProducts = 0;
  const productUpdatePromises = [];

  for (let item of items) {
    const product = await Product.findById(item.productId);
    if (!product) throw new customError("Product not found", 404);
    if (product.stock < item.quantity) {
      throw new customError(
        `Insufficient stock for ${product.productTitle}`,
        400
      );
    }

    totalPriceofProducts += product.price * item.quantity;

    // Prepare to reduce stock
    product.stock -= item.quantity;
    productUpdatePromises.push(product.save());
  }

  // Step 2: Coupon apply
  const { discountedAmount, discountAmount, coupon } =
    await applyCouponDiscount(couponCode, totalPriceofProducts);

  // Step 3: Delivery zone charge
  const deliveryZone = shippingInfo.deliveryZone;
  if (!deliveryZone || !deliveryChargeMap[deliveryZone]) {
    throw new customError("Invalid delivery zone", 400);
  }
  const deliveryCharge = deliveryChargeMap[deliveryZone];

  // Step 4: Final amount calculation
  const finalAmount = discountedAmount + deliveryCharge;

  // Step 5: Invoice ID
  const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

  // Step 6: Order create
  const order = await Order.create({
    user: userId || null,
    guestId: req.body.guestId || null,
    items: items.map((item) => ({
      productId: item.productId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
    })),
    shippingInfo,
    totalAmount: totalPriceofProducts,
    discountAmount,
    deliveryCharge,
    finalAmount,
    paymentMethod,
    invoiceId,
    paymentStatus: paymentMethod === "cod" ? "unpaid" : "pending",
    orderStatus: "pending",
    coupon: coupon ? coupon._id : undefined,
  });

  // Step 7: Reduce stock
  await Promise.all(productUpdatePromises);

  // Step 8: Handle payment
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
    ); // false = live, true = sandbox
    const sslRes = await sslcz.init(data);

    return res.status(200).json(
      apiResponse(true, {
        message: "SSLCommerz initiated",
        paymentUrl: sslRes.GatewayPageURL,
        orderId: order._id,
      })
    );
  }

  // Step 9: Send response (COD)
  res.status(201).json(
    apiResponse(true, {
      message: "Order placed successfully (COD)",
      order,
    })
  );
});
