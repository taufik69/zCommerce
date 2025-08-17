import { Order } from "../models/orderModel.js";
import axios from "axios";

export const assignCourier = async (req, res) => {
  try {
    const { orderId, courierName } = req.body;

    // Order খুঁজে বের করো
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    let trackingId = "DUMMY123"; // Default tracking ID

    // Courier Name অনুযায়ী API Call
    if (courierName === "Pathao") {
      // Pathao courier API call (dummy উদাহরণ)
      const response = await axios.post(`https://api.pathao.com/create-order`, {
        api_key: process.env.PATHAO_API_KEY,
        invoiceId: order.invoiceId,
        recipient_name: order.shippingInfo.fullName,
        recipient_phone: order.shippingInfo.phone,
        recipient_address: order.shippingInfo.address,
        amount: order.finalAmount,
      });

      trackingId = response.data.tracking_id || "PATHAO123";
    }

    if (courierName === "RedX") {
      // RedX courier API call (dummy উদাহরণ)
      const response = await axios.post(
        `https://api.redx.com.bd/parcel/create`,
        {
          api_key: process.env.REDX_API_KEY,
          orderId: order.invoiceId,
          name: order.shippingInfo.fullName,
          phone: order.shippingInfo.phone,
          address: order.shippingInfo.address,
          amount: order.finalAmount,
        }
      );

      trackingId = response.data.data?.tracking_id || "REDX123";
    }

    // Order update করো
    order.courier = {
      name: courierName,
      trackingId,
      status: "Shipped",
    };

    await order.save();

    res.status(200).json({
      message: `Order assigned to ${courierName}`,
      courier: order.courier,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
