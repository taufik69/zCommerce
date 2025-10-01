const axios = require("axios");
const BaseCourier = require("./BaseCourier");
const Order = require("../../models/order.model");
const { customError } = require("../../lib/CustomError");
const PathaoAuth = require("./PathaoAuth");
const { apiResponse } = require("../../utils/apiResponse");

class PathaoCourier extends BaseCourier {
  constructor(merchant) {
    super();
    this.merchant = merchant;
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.authService = new PathaoAuth(merchant);
  }

  // single order creation
  async createOrder(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) throw new customError("Order not found", 404);
      const accessToken = await this.authService.getValidToken();
      if (!accessToken) throw new customError("Pathao token not found", 404);
      if (!this.merchant.store_id)
        throw new customError("Pathao store ID not found", 404);

      // Make API request to create order
      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/orders`,
        {
          store_id: this.merchant.store_id || 148890,
          recipient_name: order.shippingInfo.fullName,
          recipient_phone: order.shippingInfo.phone,
          recipient_address: order.shippingInfo.address,
          delivery_type: 48,
          item_type: 2,
          item_quantity: order.totalQuantity || 1,
          item_weight: 0.5,
          amount_to_collect: Number(order.finalAmount) || 0,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.code !== 200)
        throw new customError(
          "Failed to create Pathao order: " + response.statusText,
          500
        );

      const trackingId = response.data.data.consignment_id;
      order.courier = {
        name: "pathao",
        trackingId,
        status: response.data.data.order_status,
        rawResponse: response.data,
      };
      await order.save();
      return order;
    } catch (err) {
      console.log(err.response.data);
      throw new customError("Failed to create Pathao order: " + err, 500);
    }
  }

  //bulk order creation by date range
  async bulkOrderByDate(startDate, endDate) {
    try {
      // 1. Orders
      const query = {};
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const orders = await Order.find(query);
      if (!orders.length)
        throw new customError("No orders found in this date range", 404);

      const results = [];

      // 2. Create orders one by one
      for (const order of orders) {
        try {
          const createdOrder = await this.createOrder(order._id);
          results.push({
            orderId: order._id,
            success: true,
            courier: createdOrder.courier,
          });
        } catch (err) {
          console.error(
            `Failed to create Pathao order for ${order._id}:`,
            err.response?.data || err.message
          );
          results.push({
            orderId: order._id,
            success: false,
            error: err.response?.data || err.message,
          });
        }
      }

      return results;
    } catch (err) {
      console.log(err.response?.data || err.message);
      throw new customError(
        "Failed to process orders by date: " + err.message,
        500
      );
    }
  }

  // Get short info of an order by ID
  async getOrderInfo(consignmentId) {
    try {
      if (!consignmentId)
        throw new customError("Consignment ID is required", 400);

      const accessToken = await this.authService.getValidToken();
      console.log("Access Token:", accessToken); // Debug
      if (!accessToken) throw new customError("Pathao token not found", 404);

      const response = await axios.get(
        `${this.baseURL}/aladdin/api/v1/orders/${consignmentId}/info`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error(
        "Pathao getOrderInfo error:",
        err.response.data || err.message
      );
      throw new customError(
        "Failed to get Pathao order info: " + err.message,
        500
      );
    }
  }

  // Handle Pathao webhook
  async handlePathaoWebhook(req, res) {
    try {
      const signature = req.headers["x-pathao-signature"];
      // 1. Verify signature
      if (signature !== process.env.WEBHOOK_SECRET) {
        throw new customError("Invalid signature", 401);
      }
      console.log("Signature:", signature, "Body:", req.body);
      res.setHeader(
        "X-Pathao-Merchant-Webhook-Integration-Secret",
        process.env.WEBHOOK_SECRET || "f3992ecc-59da-4cbe-a049-a13da2018d51"
      );
      res.status(202).json({ message: "Webhook received" });
      await this.processWebhook(req.body);
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // background processor
  async processWebhook(body) {
    try {
      const consignmentId = body.consignment_id;
      const orderStatus = body.order_status;

      console.log("Processing webhook:", consignmentId, orderStatus);

      if (consignmentId && orderStatus) {
        // 2. Update order in DB
        if (consignmentId && orderStatus) {
          const updatedOrder = await Order.findOneAndUpdate(
            { "courier.trackingId": consignmentId },
            { $set: { "courier.status": orderStatus } },
            { new: true }
          );
          console.log(`✅ Order ${consignmentId} updated to ${updatedOrder}`);
        }
      }
    } catch (err) {
      console.error("Background webhook processing error:", err);
    }
  }
}

module.exports = PathaoCourier;
