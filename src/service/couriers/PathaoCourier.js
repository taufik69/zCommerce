// services/couriers/PathaoCourier.js
const axios = require("axios");
const BaseCourier = require("./BaseCourier");
const Order = require("../../models/order.model");
const { customError } = require("../../lib/CustomError");

class PathaoCourier extends BaseCourier {
  async createOrder(marchantInfo, orderId) {
    try {
      console.log("Creating Pathao order for orderId:", marchantInfo, orderId);
      if (!marchantInfo || !marchantInfo.merchantID) {
        throw new customError("Merchant information is required", 400);
      }
      if (!orderId) {
        throw new customError("Order ID is required", 400);
      }
      const order = await Order.findById(orderId);
      if (!order) throw new customError("Order not found", 404);
      console.log(order);
      return;

      const response = await axios.post(
        `${marchantInfo.baseURL}/create-order`,
        {
          api_key: marchantInfo.merchantID,
          invoiceId: order.invoiceId,
          recipient_name: order.shippingInfo.fullName,
          recipient_phone: order.shippingInfo.phone,
          recipient_address: order.shippingInfo.address,
          amount: order.finalAmount,
        }
      );

      const trackingId = response.data.tracking_id || "PATHAO123";

      order.courier = {
        name: "Pathao",
        trackingId,
        status: "Shipped",
        lastUpdated: new Date(),
      };

      await order.save();
      return order;
    } catch (err) {
      console.error("Pathao createOrder error:", err.message);
      throw new customError(
        "Failed to create Pathao order: " + err.message,
        500
      );
    }
  }

  async trackOrder(trackingId) {
    try {
      const order = await Order.findOne({ "courier.trackingId": trackingId });
      if (!order) throw new customError("Order not found for tracking ID", 404);

      const response = await axios.get(
        `https://api.pathao.com/track/${trackingId}`,
        { headers: { Authorization: `Bearer ${process.env.PATHAO_API_KEY}` } }
      );

      order.courier.status = response.data.status || "Unknown";
      order.courier.lastUpdated = new Date();
      await order.save();

      return order;
    } catch (err) {
      console.error("Pathao trackOrder error:", err.message);
      throw new customError(
        "Failed to track Pathao order: " + err.message,
        500
      );
    }
  }

  async cancelOrder(trackingId) {
    try {
      const order = await Order.findOne({ "courier.trackingId": trackingId });
      if (!order) throw new customError("Order not found for tracking ID", 404);

      const response = await axios.post(
        `https://api.pathao.com/cancel/${trackingId}`,
        {},
        { headers: { Authorization: `Bearer ${process.env.PATHAO_API_KEY}` } }
      );

      order.courier.status = response.data.status || "Cancelled";
      order.courier.lastUpdated = new Date();
      await order.save();

      return order;
    } catch (err) {
      console.error("Pathao cancelOrder error:", err.message);
      throw new customError(
        "Failed to cancel Pathao order: " + err.message,
        500
      );
    }
  }

  async bulkOrder(orderIds) {
    try {
      const orders = await Order.find({ _id: { $in: orderIds } });
      if (!orders.length)
        throw new customError("No orders found for bulk creation", 404);

      const payload = orders.map((order) => ({
        invoiceId: order.invoiceId,
        recipient_name: order.shippingInfo.fullName,
        recipient_phone: order.shippingInfo.phone,
        recipient_address: order.shippingInfo.address,
        amount: order.finalAmount,
      }));

      const response = await axios.post(
        `https://api.pathao.com/bulk-create`,
        { orders: payload },
        { headers: { Authorization: `Bearer ${process.env.PATHAO_API_KEY}` } }
      );

      response.data.orders.forEach((item, index) => {
        orders[index].courier = {
          name: "Pathao",
          trackingId: item.tracking_id || `PATHAO${index + 1}`,
          status: "Shipped",
          lastUpdated: new Date(),
        };
      });

      await Promise.all(orders.map((o) => o.save()));
      return orders;
    } catch (err) {
      console.error("Pathao bulkOrder error:", err.message);
      throw new customError(
        "Failed to create bulk Pathao orders: " + err.message,
        500
      );
    }
  }

  async getStatus(trackingId) {
    try {
      const order = await Order.findOne({ "courier.trackingId": trackingId });
      if (!order) throw new customError("Order not found for tracking ID", 404);

      const response = await axios.get(
        `https://api.pathao.com/status/${trackingId}`,
        { headers: { Authorization: `Bearer ${process.env.PATHAO_API_KEY}` } }
      );

      order.courier.status = response.data.status || "Unknown";
      order.courier.lastUpdated = new Date();
      await order.save();

      return order;
    } catch (err) {
      console.error("Pathao getStatus error:", err.message);
      throw new customError(
        "Failed to get Pathao order status: " + err.message,
        500
      );
    }
  }
}

module.exports = PathaoCourier;
