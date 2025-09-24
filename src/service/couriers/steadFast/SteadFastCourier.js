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
  //   create bulk order
  // Bulk Create Orders
  async bulkCreateOrders(startDate, endDate) {
    try {
      let query = {};
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
      const orders = await Order.find(query).sort({ createdAt: -1 });

      if (!orders.length) {
        throw new customError("No orders found for bulk create", 404);
      }

      console.log(orders);
      return;

      // 2. Payload বানানো
      const data = orders.map((order) => ({
        invoice: order.invoiceId || order._id.toString(),
        recipient_name: order.shippingInfo?.fullName || "N/A",
        recipient_address: order.shippingInfo?.address || "N/A",
        recipient_phone: order.shippingInfo?.phone || "",
        cod_amount: order.finalAmount || 0,
        note: order.note || "",
      }));

      // 3. API Request পাঠানো
      const response = await axios.post(
        `${this.baseUrl}/create_order/bulk-order`,
        { data },
        {
          headers: {
            "Api-Key": this.ApiKey,
            "Secret-Key": this.ApiSecret,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Bulk Orders Created Successfully:", response.data);
      return response.data;
    } catch (err) {
      console.error("❌ Bulk Order Error:", err.response?.data || err.message);
      throw new customError(
        "Failed to bulk create Steadfast orders: " +
          (err.response?.data?.message || err.message),
        500
      );
    }
  }
}

module.exports = SteadFastCourier;
