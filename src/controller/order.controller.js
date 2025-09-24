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
const Variant = require("../models/variant.model");
const { sendEmail } = require("../helpers/nodemailer");
const { orderTemplate } = require("../emailTemplate/orderTemplate");

const { sendSMS } = require("../helpers/sms");
const { getIO } = require("../socket/socket");

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
    coupon.usedCount += 1;
    discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
  } else if (coupon.discountType === "fixed") {
    coupon.usedCount += 1;
    discountAmount = Math.round(coupon.discountValue);
  }

  // ensure the discounted amount is not negative
  const discountedAmount = Math.max(0, subtotal - discountAmount);

  // Do NOT update coupon usage here. We will update after order is successful.
  return { discountedAmount, discountAmount, coupon };
};

// Main controller
exports.createOrder = asynchandeler(async (req, res) => {
  const userId = req.user?._id || req.body.user || null;
  const { guestId, shippingInfo, paymentMethod, couponCode, deliveryCharge } =
    req.body;

  // Step 1: Load Cart
  const cart = await cartModel.findOne({
    user: userId || null,
    guestId: guestId || null,
  });

  if (!cart || !cart.items || cart.items.length === 0) {
    throw new customError("No items in the cart", 400);
  }

  // Step 2: Calculate subtotal & Check stock
  let totalPriceofProducts = 0;
  let totalProductInfo = [];

  for (const item of cart.items) {
    // যদি product থাকে
    if (item.product) {
      const product = await Product.findById(item.product).populate(
        "category subcategory brand"
      );
      if (!product) throw new customError(`Product not found`, 404);
      if (product?.stock < item?.quantity) {
        throw new customError(
          `${product.name} does not have enough stock`,
          400
        );
      }
      totalProductInfo.push({
        product: product,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        retailPrice: product.retailPrice,
        size: item.size,
        color: item.color,
        variant: item.variant || null,
        orderType: "singlevariant",
      });
      totalPriceofProducts += item.totalPrice;
      product.totalSales += item.quantity;
    }

    // যদি variant থাকে
    if (item.variant) {
      const variant = await Variant.findById(item.variant).populate("product");

      if (!variant) throw new customError(`Variant not found`, 404);

      if (variant.stockVariant < item.quantity) {
        throw new customError(
          `${variant.variantName} does not have enough stock from variant`,
          400
        );
      }
      totalProductInfo.push({
        variant: variant,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        retailPrice: variant.retailPrice,
        size: item.size,
        color: item.color,
        product: item.product || null,
        orderType: "multivariant",
      });
      totalPriceofProducts += item.totalPrice;
      variant.totalSales += item.quantity;
    }
  }

  // Step 3: Apply Coupon
  const { discountedAmount, discountAmount, coupon } =
    await applyCouponDiscount(couponCode, totalPriceofProducts);

  // Step 4: Delivery Charge
  const deliveryChargeAmount = await applyDeliveryCharge(deliveryCharge);
  if (!deliveryChargeAmount)
    throw new customError("Invalid delivery type", 400);

  // Step 5: Final Total
  const finalAmount = couponCode
    ? discountedAmount + deliveryChargeAmount.deliveryCharge
    : totalPriceofProducts + deliveryChargeAmount.deliveryCharge;

  // Step 6: Create the Order
  const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

  let order = null;
  try {
    order = await Order.create({
      user: userId || null,
      guestId: guestId || null,
      items: totalProductInfo,
      shippingInfo,
      totalAmount: totalPriceofProducts,
      discountAmount,
      finalAmount,
      deliveryCharge: deliveryChargeAmount._id,
      paymentMethod,
      invoiceId,
      paymentStatus: paymentMethod === "cod" ? "Pending" : "Pending",
      // paymentStatus: paymentMethod === "cod" ? "unpaid" : "pending",
      orderStatus: "Pending",
      coupon: coupon ? coupon._id : undefined,
    });

    // Step 7: Update stock and coupon usage after successful order creation
    // Step 7: Update stock and coupon usage after successful order creation
    const stockUpdatePromises = [];
    for (const item of cart.items) {
      // Product stock update
      if (item.product) {
        stockUpdatePromises.push(
          Product.updateOne(
            { _id: item.product },
            {
              $inc: { stock: -item.quantity, totalSales: item.quantity },
            }
          )
        );
      }
      // Variant stock update
      if (item.variant) {
        stockUpdatePromises.push(
          Variant.updateOne(
            { _id: item.variant },
            {
              $inc: { stockVariant: -item.quantity, totalSales: item.quantity },
            }
          )
        );
      }
    }
    await Promise.all(stockUpdatePromises);

    if (coupon) {
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
    }

    // Step 8: Create the Invoice Document
    const invoice = await Invoice.create({
      order: order._id,
      invoiceId: order.invoiceId,
      customerDetails: shippingInfo,
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
      const data = await sendEmail(
        shippingInfo?.email,
        "Order Confirmation",
        orderTemplateHtml
      );
      if (!data) {
        throw new customError("Failed to send email", 500);
      }
    }

    if (shippingInfo.phone) {
      const message = `🙋‍♂️ প্রিয় ${shippingInfo?.fullName},
    📦 আপনার অর্ডার #${order?.invoiceId} সফলভাবে সম্পন্ন হয়েছে ✅
    💰 মোট দাম: ৳ ${order?.finalAmount}
    আমাদের সাথে থাকার জন্য ধন্যবাদ!
    ☎ সহায়তার জন্য কল করুন: ${process.env.ORDER_HOT_LINE_NUMBER}`;

      const data = await sendSMS(shippingInfo?.phone, message);
      if (data.response_code == 202) {
        console.log(" send sms sucessfully");
      }
    }

    // // Step 10: Clear cart
    await cartModel.deleteOne({
      user: userId || null,
      guestId: req.body.guestId || null,
    });

    // Step 11: SSLCommerz or COD Success
    if (paymentMethod === "sslcommerz") {
      const data = {
        total_amount: Math.round(finalAmount),
        currency: "BDT",
        tran_id: invoiceId, // required, must be unique per transaction
        success_url: `${process.env.BACKEND_URL}/payment/success`,
        fail_url: `${process.env.BACKEND_URL}/payment/fail`,
        cancel_url: `${process.env.BACKEND_URL}/payment/cancel`,
        ipn_url: `${process.env.BACKEND_URL}/payment/ipn`,
        product_name:
          (totalProductInfo && totalProductInfo?.map((item) => item.name)).join(
            ","
          ) || "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        shipping_method: "Courier",
        ship_name: "Customer Name",
        ship_add1: shippingInfo.fullName,
        ship_postcode: shippingInfo.postalCode || 1000,
        ship_city: "Dhaka",
        ship_country: "Bangladesh",
        cus_name: shippingInfo.fullName, // required
        cus_email: shippingInfo.email || "taufikislam172@gmail.com", // required
        cus_add1: shippingInfo.address, // required
        cus_phone: shippingInfo.phone, // required
      };

      const is_live = process.env.NODE_ENV === "production" ? true : false;
      const sslcz = new SSLCommerzPayment(
        process.env.SSLC_STORE_ID,
        process.env.SSLC_STORE_PASSWORD,
        is_live
      );
      const response = await sslcz.init(data);
      // Redirect the user to payment gateway

      console.log("Redirecting to: ", response.GatewayPageURL);

      // Emit order event
      const io = getIO();
      io.emit("orderPlaced", {
        message: "🛒New Order added",
        order: order,
      });
      // return res.status(301).redirect(response.GatewayPageURL);
      apiResponse.sendSuccess(res, 201, "Order placed successfully", {
        url: response.GatewayPageURL,
        order,
      });
    } else {
      // Final success response
      apiResponse.sendSuccess(res, 201, "Order placed successfully", order);
    }
  } catch (error) {
    console.log(error);
    // If order creation or any subsequent step fails, we must rollback stock and coupon usage
    if (order && order._id) {
      // Rollback stock
      const stockUpdatePromises = [];
      for (const item of cart.items) {
        // Product stock update
        if (item.product) {
          stockUpdatePromises.push(
            Product.updateOne(
              { _id: item.product },
              {
                $inc: { stock: -item.quantity, totalSales: item.quantity },
              }
            )
          );
        }
        // Variant stock update
        if (item.variant) {
          stockUpdatePromises.push(
            Variant.updateOne(
              { _id: item.variant },
              {
                $inc: {
                  stockVariant: -item.quantity,
                  totalSales: item.quantity,
                },
              }
            )
          );
        }
      }
      await Promise.all(stockUpdatePromises);
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
    throw new customError(error.message, 500);
  }
});

// @desc Get all orders

exports.getAllOrders = asynchandeler(async (req, res) => {
  const orders = await Order.find()
    .populate("user")
    .populate("deliveryCharge")
    .populate("coupon")
    .sort({ createdAt: -1 })
    .lean();
  apiResponse.sendSuccess(res, 200, "Orders fetched successfully", orders);
});

//@desc get single order
exports.getSingleOrder = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const singleOrder = await Order.findOne({ _id: id })
    .populate("user")
    .populate("deliveryCharge")
    .populate("coupon")
    .sort({ createdAt: -1 })
    .lean();
  if (!singleOrder) {
    throw new customError("Order not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Order fetched successfully", singleOrder);
});

//@desc find oder by id and update orderStatus
exports.updateOrder = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const { orderStatus, shippingInfo } = req.body;

  const singleOrder = await Order.findOne({ _id: id });
  if (!singleOrder) {
    throw new customError("Order not found", 404);
  }

  // if orderStatus is Cancelled then rollback stock
  if (orderStatus === "Cancelled" || orderStatus === "Delivered") {
    const stockUpdatePromises = [];

    for (const item of singleOrder.items) {
      // Product stock update
      if (item.product) {
        stockUpdatePromises.push(
          Product.updateOne(
            { _id: item.product._id },
            { $inc: { stock: item.quantity, totalSales: -item.quantity } },
            { new: true }
          )
        );
      }

      // Variant stock update
      if (item.variant) {
        stockUpdatePromises.push(
          Variant.updateOne(
            { _id: item.variant._id },
            {
              $inc: { stockVariant: item.quantity, totalSales: -item.quantity },
            },
            { new: true }
          )
        );
      }
    }

    // Run all updates together
    await Promise.all(stockUpdatePromises);
  }

  // Update order fields
  singleOrder.orderStatus = orderStatus;
  singleOrder.shippingInfo = shippingInfo;
  await singleOrder.save();

  apiResponse.sendSuccess(res, 200, "Order updated successfully", singleOrder);
});

// fiter order using datewise like today and yesterday last 7 days last month
exports.filterOrderdatewise = asynchandeler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // convert to Date objects
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const filter = {};
    if (start && end) {
      filter.createdAt = { $gte: start, $lt: end };
    } else if (start) {
      filter.createdAt = { $gte: start };
    } else if (end) {
      filter.createdAt = { $lt: end };
    }

    const orders = await Order.find(filter)
      .populate("user")
      .populate("deliveryCharge")
      .populate("coupon")
      .sort({ createdAt: -1 })
      .lean();

    apiResponse.sendSuccess(res, 200, "Orders fetched successfully", orders);
  } catch (err) {
    apiResponse.sendError(res, 500, "Error fetching orders", err.message);
  }
});

// track order by invoice id
exports.trackOrder = asynchandeler(async (req, res) => {
  const { invoiceid } = req.params;
  const order = await Order.findOne({ invoiceId: invoiceid })
    .populate("user")
    .populate("deliveryCharge")
    .populate("coupon") 
    .sort({ createdAt: -1 })
    .lean();
  if (!order) {
    throw new customError("Order not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Order fetched successfully", order);
});

// delete order when delete order then rollback stock and coupon usage and also delete invoice
// (This functionality is now integrated into the deleteOrder method above)
exports.deleteOrder = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const singleOrder = await Order.findOne ({ _id: id });
  if (!singleOrder) {
    throw new customError("Order not found", 404);
  }


  // Rollback stock
  const stockUpdatePromises = [];
  for (const item of singleOrder.items) {
    // Product stock update
    if (item.product) {
      stockUpdatePromises.push(
        Product.updateOne(
          { _id: item.product._id },
          { $inc: { stock: item.quantity, totalSales: -item.quantity } },
          { new: true }
        )
      );
    }
    // Variant stock update
    if (item.variant) {
      stockUpdatePromises.push(
        Variant.updateOne(
          { _id: item.variant._id },
          { $inc: { stockVariant: item.quantity, totalSales: -item.quantity } },
          { new: true }
        )
      );
    }
  }
  await Promise.all(stockUpdatePromises);
  // Rollback coupon usage
  if (singleOrder.coupon) {
    await Coupon.updateOne(
      { _id: singleOrder.coupon },
      { $inc: { usedCount: -1 } }
    );
  }
  // Delete the order
  await Order.deleteOne({ _id: id });
  // Also delete associated invoice
  await Invoice.deleteOne({ order: id });

  apiResponse.sendSuccess(res, 200, "Order deleted successfully", null);
});


