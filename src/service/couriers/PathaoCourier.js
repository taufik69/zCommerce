const axios = require("axios");
const BaseCourier = require("./BaseCourier");
const Order = require("../../models/order.model");
const { customError } = require("../../lib/CustomError");
const PathaoAuth = require("./PathaoAuth");

class PathaoCourier extends BaseCourier {
  constructor(merchant) {
    super();
    this.merchant = merchant;
    this.baseURL = merchant.baseURL || "https://courier-api-sandbox.pathao.com";
    this.authService = new PathaoAuth(merchant);
  }

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

  async bulkOrder(orderIds) {
    try {
      const orders = await Order.find({ _id: { $in: orderIds } });
      if (!orders.length) throw new customError("No orders found", 404);

      const accessToken = await this.authService.getValidToken();

      const payload = orders.map((order) => ({
        store_id: this.merchant.store_id,
        merchant_order_id: order.invoiceId,
        recipient_name: order.shippingInfo.fullName,
        recipient_phone: order.shippingInfo.phone,
        recipient_address: order.shippingInfo.address,
        recipient_city: order.shippingInfo.city_id,
        recipient_zone: order.shippingInfo.zone_id,
        recipient_area: order.shippingInfo.area_id,
        delivery_type: 48,
        item_type: 2,
        item_quantity: 1,
        item_weight: "0.5",
        item_description: order.productDescription || "Product",
        amount_to_collect: order.finalAmount,
      }));

      const response = await axios.post(
        `${this.baseURL}/aladdin/api/v1/orders/bulk`,
        { orders: payload },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      response.data.data.forEach((item, index) => {
        orders[index].courier = {
          name: "Pathao",
          trackingId: item.consignment_id,
          status: item.order_status,
          lastUpdated: new Date(),
        };
      });

      await Promise.all(orders.map((o) => o.save()));
      return orders;
    } catch (err) {
      throw new customError(
        "Failed to create bulk Pathao orders: " + err.message,
        500
      );
    }
  }
}

module.exports = PathaoCourier;
