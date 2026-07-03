const mongoose = require("mongoose");
const User = require("../models/user.model");
const Order = require("../models/order.model");
const Sales = require("../models/sales.model");
const { customerModel } = require("../models/customer.model");

/**
 * Recipient groups supported by the Bulk SMS module.
 * The key is the value sent from the frontend dropdown.
 */
const RECIPIENT_TYPES = {
  logged: "Logged Customers",
  order: "Order Customers",
  sales_walking: "Walking Customers",
  sales_listed: "Listed Customers",
};

const normalizePhone = (phone) =>
  typeof phone === "string" ? phone.trim() : "";

/**
 * Resolve the deduplicated recipient list for a given group.
 * Returns an array of { customerId?, name, phone } — phone is always present.
 */
const resolveRecipients = async (recipientType) => {
  switch (recipientType) {
    case "logged": {
      // Registered users (logged-in customer accounts)
      const users = await User.find({ phone: { $ne: null } })
        .select("_id name phone")
        .lean();
      return dedupe(
        users.map((u) => ({
          customerId: null,
          name: u.name || "",
          phone: normalizePhone(u.phone),
        })),
      );
    }

    case "order": {
      // Customers who placed online orders (from shipping info)
      const orders = await Order.find({ "shippingInfo.phone": { $ne: null } })
        .select("shippingInfo.phone shippingInfo.fullName")
        .lean();
      return dedupe(
        orders.map((o) => ({
          customerId: null,
          name: o.shippingInfo?.fullName || "",
          phone: normalizePhone(o.shippingInfo?.phone),
        })),
      );
    }

    case "sales_walking": {
      // Walking (non-listed) customers from sales — phone comes from the embedded doc
      const sales = await Sales.find({ "customerType.type": "walking" })
        .select("customerType.walking")
        .lean();

      const walkingList = sales
        .map((s) => s.customerType?.walking)
        .filter(Boolean)
        .map((w) => ({
          customerId: null,
          name: w.customerName || "",
          phone: normalizePhone(w.mobileNumber),
        }));

      return dedupe(walkingList);
    }

    case "sales_listed": {
      // Listed customers from sales — resolve unique customer IDs to their phone numbers
      const sales = await Sales.find({ "customerType.type": "listed" })
        .select("customerType.customerId")
        .lean();

      const listedIdSet = new Set();
      for (const s of sales) {
        const id = s.customerType?.customerId;
        if (id) listedIdSet.add(id.toString());
      }

      const listedIds = [...listedIdSet].map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      const customersFromSales = listedIds.length
        ? await customerModel.find({ _id: { $in: listedIds } })
            .select("_id fullName mobileNumber")
            .lean()
        : [];

      const listedList = customersFromSales.map((c) => ({
        customerId: c._id,
        name: c.fullName || "",
        phone: normalizePhone(c.mobileNumber),
      }));

      return dedupe(listedList);
    }

    default:
      return [];
  }
};

/**
 * Remove entries with empty phones and collapse duplicates by phone,
 * keeping the first non-empty name / customerId seen.
 */
const dedupe = (recipients) => {
  const map = new Map();
  for (const r of recipients) {
    const phone = normalizePhone(r.phone);
    if (!phone) continue;
    const existing = map.get(phone);
    if (existing) {
      if (!existing.name && r.name) existing.name = r.name;
      if (!existing.customerId && r.customerId) existing.customerId = r.customerId;
      continue;
    }
    map.set(phone, { customerId: r.customerId || null, name: r.name || "", phone });
  }
  return Array.from(map.values());
};

/**
 * Count recipients per group without building the full recipient objects
 * (still deduped so the number matches what would actually be sent).
 */
const countRecipients = async () => {
  const [logged, order, salesWalking, salesListed] = await Promise.all([
    resolveRecipients("logged"),
    resolveRecipients("order"),
    resolveRecipients("sales_walking"),
    resolveRecipients("sales_listed"),
  ]);
  return {
    logged: logged.length,
    order: order.length,
    sales_walking: salesWalking.length,
    sales_listed: salesListed.length,
  };
};

module.exports = {
  RECIPIENT_TYPES,
  resolveRecipients,
  countRecipients,
};
