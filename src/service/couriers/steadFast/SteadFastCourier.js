const axios = require("axios");
const BaseCourier = require("../BaseCourier");
const Order = require("../../../models/order.model");
const { customError } = require("../../../lib/CustomError");
const { apiResponse } = require("../../../utils/apiResponse");

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
  // Bulk Create Orders (with orderIds array)
  async bulkCreateOrders(orderIds = []) {
    try {
      if (!orderIds.length) {
        throw new customError("No orderIds provided", 400);
      }

      // Create orders one by one
      const results = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            // Create order
            const order = await this.createOrder(orderId);

            return {
              invoice: order.invoiceId,
              trackingId: order.courier?.trackingId,
              status: order.courier?.status,
            };
          } catch (err) {
            console.error(`❌ Order ${orderId} error:`, err.message);
            return {
              orderId,
              error: err.message,
            };
          }
        })
      );

      console.log("✅ Bulk Orders Created:", results);
      return results;
    } catch (err) {
      console.error("❌ Bulk Order Error:", err);
      throw new customError(
        "Failed to bulk create Steadfast orders: " + err.message,
        500
      );
    }
  }

  // steadfast webhook handler
  async handleSteadFastWebhook(req, res) {
    try {
      // 1️⃣ Token Verify
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new customError("Invalid authorization header", 401);
      }

      const token = authHeader.split(" ")[1];
      if (token !== process.env.STEADFAST_API_KEY && token !== this.ApiKey) {
        throw new customError("Invalid API token", 403);
      }

      // 2️⃣ Webhook Data
      const data = req.body;
      const { invoice, status, tracking_code } = data;

      if (!invoice) {
        throw new customError("Invoice ID missing in webhook", 400);
      }

      // 3️⃣ Order find
      const order = await Order.findOne({ invoiceId: invoice });
      if (!order) {
        throw new customError("Order not found for invoice: " + invoice, 404);
      }

      // 4️⃣ Update courier details
      order.courier.status = status || order.courier.status;
      order.courier.trackingId = tracking_code || order.courier.trackingId;
      order.courier.rawResponse = { ...order.courier.rawResponse, ...data };

      await order.save();

      // 5️⃣ Success response
      console.log("✅ SteadFast Webhook processed successfully");
      res.status(200).json({
        status: "success",
        message: "Webhook received successfully.",
      });
      return order;
    } catch (err) {
      console.error("❌ Steadfast Webhook Error:", err);
      res.status(200).json({
        status: "error",
        message: "Invalid consignment ID.",
      });
      throw new customError(
        "Failed to process Steadfast webhook: " + err.message,
        500
      );
    }
  }
}

module.exports = SteadFastCourier;
