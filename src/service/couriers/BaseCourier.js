// services/couriers/BaseCourier.js
class BaseCourier {
  async createOrder(order) {
    throw new Error("createOrder not implemented");
  }

  async trackOrder(trackingId) {
    throw new Error("trackOrder not implemented");
  }

  async cancelOrder(trackingId) {
    throw new Error("cancelOrder not implemented");
  }

  async bulkOrder(orders) {
    throw new Error("bulkOrder not implemented");
  }

  async getStatus(trackingId) {
    throw new Error("getStatus not implemented");
  }
}

module.exports = BaseCourier;
