const axios = require("axios");
const BaseCourier = require("../BaseCourier");
const Order = require("../../../models/order.model");
const { customError } = require("../../../lib/CustomError");

class SteadFastCourier extends BaseCourier {
  constructor(merchant) {
    super();
    this.merchant = merchant;
    this.baseURL = merchant.baseURL;
    this.ApiKey = merchant.merchantID;
    this.ApiSecret = merchant.merchantSecret;
    console.log("SteadFastCourier initialized with merchant:", this.baseURL);
  }

  //   Create single order
  async createOrder(orderId) {
    try {
      // 1. Order find
      const order = await Order.findById(orderId);
      if (!order) throw new customError("Order not found", 404);

      // 2. Payload prepare
      const payload = {
        invoice: order.invoiceId,
        recipient_name: order.shippingInfo.fullName,
        recipient_phone: order.shippingInfo.phone,
        recipient_address: order.shippingInfo.address,
        cod_amount: order.finalAmount || 0,
      };

      // 3. API request
      const response = await axios.post(
        `${this.baseURL}/create_order`,

        payload,
        {
          headers: {
            "Api-Key": this.ApiKey,
            "Secret-Key": this.ApiSecret,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("SteadFast create order response:", response);

      if (response.data.status !== 200) {
        throw new customError(
          `SteadFast API error: ${response.data.message}`,
          500
        );
      }
      console.log("SteadFast create order response:", response.data);

      const trackingId = response.data.consignment.tracking_code;

      order.courier = {
        name: "steadfast",
        trackingId,
        status: response.data.consignment.status,
        rawResponse: response.data,
        lastUpdated: new Date(),
      };

      await order.save();
      return order;
    } catch (err) {
      console.log(err);
      throw new customError("Failed to create steadFast order: " + err, 500);
    }
  }

  // Bulk Create Orders
  async bulkCreateOrders(startDate, endDate) {
    try {
      let query = {};
      if (startDate && endDate) {
        let start = startDate;
        let end = endDate;
        if (start > end) [start, end] = [end, start];
        query.createdAt = { $gte: start, $lte: end };
      }

      const orders = await Order.find(query);

      if (!orders.length) {
        throw new customError("No orders found for bulk create", 404);
      }

      // Prepare valid orders
      const validOrders = orders.filter(
        (order) =>
          order.invoiceId &&
          order.shippingInfo?.fullName &&
          order.shippingInfo?.phone &&
          order.shippingInfo?.address &&
          order.finalAmount > 0
      );

      if (validOrders.length === 0) {
        throw new customError("No valid orders to send", 400);
      }

      // Send each order one by one using Promise.all
      const results = await Promise.all(
        validOrders.map(async (order) => {
          try {
            const payload = {
              invoice: order.invoiceId,
              recipient_name: order.shippingInfo.fullName,
              recipient_phone: order.shippingInfo.phone,
              recipient_address: order.shippingInfo.address,
              cod_amount: order.finalAmount || 0,
            };

            const response = await axios.post(
              `${this.baseURL}/create_order`,
              payload,
              {
                headers: {
                  "Api-Key": this.ApiKey,
                  "Secret-Key": this.ApiSecret,
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.data.status !== 200) {
              throw new customError(
                `SteadFast API error: ${response.data.message}`,
                500
              );
            }

            const consignment = response.data.consignment;
            order.courier = {
              name: "steadfast",
              trackingId: consignment.tracking_code,
              status: consignment.status,
              rawResponse: consignment,
            };
            await order.save();

            return {
              invoice: order.invoiceId,
              trackingId: consignment.tracking_code,
              status: consignment.status,
              consignment_id: consignment.consignment_id,
            };
          } catch (err) {
            console.error(`❌ Order ${order.invoiceId} error:`, err.message);
            return {
              invoice: order.invoiceId,
              error: err.message,
            };
          }
        })
      );

      console.log("✅ Bulk Orders Created (single API):", results);
      return results;
    } catch (err) {
      console.error("❌ Bulk Order Error:", err);
      throw new customError(
        "Failed to bulk create Steadfast orders: " +
          (err.response?.data?.message || err.message),
        500
      );
    }
  }
}

module.exports = SteadFastCourier;
