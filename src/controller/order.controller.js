// required modules
const Order = require("../models/order.model");
const DeliveryCharge = require("../models/delivery.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
// Import the new Invoice model
const Invoice = require("../models/invoice.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const { v4: uuidv4 } = require("uuid");
const SSLCommerzPayment = require("sslcommerz-lts");
const cartModel = require("../models/cart.model");
// require the nodemailer for sending emails
const nodemailer = require("nodemailer");
// require the pdfkit for generating pdf invoices
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { sendEmail } = require("../helpers/nodemailer");
const { orderTemplate } = require("../emailTemplate/orderTemplate");

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

  // ensure the discounted amount is not negative
  const discountedAmount = Math.max(0, subtotal - discountAmount);

  // Do NOT update coupon usage here. We will update after order is successful.
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

  if (!cart || !cart.items || cart.items.length === 0) {
    throw new customError("No items in the cart", 400);
  }

  // Step 2: Calculate subtotal & Check stock
  let totalPriceofProducts = 0;
  let totalProductInfo = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    totalProductInfo.push({
      name: product.name,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    });
    if (!product) throw new customError(`Product not found`, 404);
    if (product.stock < item.quantity) {
      throw new customError(
        `${product.productTitle} does not have enough stock`,
        400
      );
    }

    totalPriceofProducts += item.totalPrice;
  }

  // Step 3: Apply Coupon
  const { discountedAmount, discountAmount, coupon } =
    await applyCouponDiscount(couponCode, totalPriceofProducts);

  // Step 4: Delivery Charge
  const deliveryChargeAmount = await applyDeliveryCharge(deliveryCharge);
  if (!deliveryChargeAmount)
    throw new customError("Invalid delivery type", 400);

  // Step 5: Final Total
  const finalAmount = discountedAmount + deliveryChargeAmount.deliveryCharge;

  // Step 6: Create the Order
  const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

  let order = null;
  try {
    order = await Order.create({
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

    // Step 7: Update stock and coupon usage after successful order creation
    const productUpdatePromises = [];
    for (const item of cart.items) {
      productUpdatePromises.push(
        Product.updateOne(
          { _id: item.product },
          { $inc: { stock: -item.quantity } }
        )
      );
    }
    await Promise.all(productUpdatePromises);

    if (coupon) {
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
    }

    // Step 8: Create the Invoice Document
    const invoice = await Invoice.create({
      order: order._id,
      invoiceId: order.invoiceId,
      customerDetails: {
        fullName: shippingInfo.fullName,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        city: shippingInfo.city,
      },
      totalAmount: totalPriceofProducts,
      discountAmount,
      deliveryChargeAmount: deliveryChargeAmount.deliveryCharge,
      finalAmount,
    });

    // if email have then send a email
    if (shippingInfo.email) {
      const orderTemplateHtml = orderTemplate(
        order,
        shippingInfo,
        invoice,
        totalProductInfo
      );
      await sendEmail(
        shippingInfo.email,
        "Order Confirmation",
        orderTemplateHtml
      );
    }
    return res.end("Order placed successfully");

    // Step 10: Clear cart
    await cartModel.deleteOne({
      user: userId || null,
      guestId: req.body.guestId || null,
    });

    // Step 11: SSLCommerz or COD Success
    if (paymentMethod === "sslcommerz") {
      // The SSLCommerz logic remains the same
      // ...
    }

    // Final success response
    apiResponse.sendSuccess(res, 201, "Order placed successfully", order);
  } catch (error) {
    // If order creation or any subsequent step fails, we must rollback stock and coupon usage
    if (order && order._id) {
      // Rollback stock
      const productUpdatePromises = [];
      for (const item of cart.items) {
        productUpdatePromises.push(
          Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } }
          )
        );
      }
      await Promise.all(productUpdatePromises);
      console.log("Stock rolled back due to error.");

      // Rollback coupon usage
      if (coupon) {
        await Coupon.updateOne(
          { _id: coupon._id },
          { $inc: { usedCount: -1 } }
        );
        console.log("Coupon usage rolled back due to error.");
      }

      // Delete the incomplete order
      await Order.deleteOne({ _id: order._id });
      console.log("Incomplete order deleted.");
    }
    throw error; // Re-throw the error for the async handler to catch
  }
});
