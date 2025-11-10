const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

// ✅ Client Required Permissions (Final)
const permissionList = [
  { permissionName: "Product" },
  { permissionName: "Category" },
  { permissionName: "Sub Category" },
  { permissionName: "Brand" },
  { permissionName: "Create Banner" },
  { permissionName: "Size Chart" },
  { permissionName: "Variant" },
  { permissionName: "Purchase" },
  { permissionName: "Purchase Return" },
  { permissionName: "Discount" },
  { permissionName: "Discount Banner" },
  { permissionName: "Coupon" },
  { permissionName: "Order" },
  { permissionName: "Incomplete Order" },
  { permissionName: "Courier Delivery" },
  { permissionName: "Courier Merchant" },
  { permissionName: "Courier Return" },
  { permissionName: "Delivery Charge" },
  { permissionName: "View All Stock" },
  { permissionName: "Category Stock Details" },
  { permissionName: "Size & Color Wise Stock" },
  { permissionName: "Size Wise Stock" },
  { permissionName: "Low Stock" },
  { permissionName: "Stock Adjustment" },
  { permissionName: "Add Transaction" },
  { permissionName: "Transaction Category" },
  { permissionName: "Add Account" },
  { permissionName: "Money Transfer" },
  { permissionName: "Money Handover" },
  { permissionName: "Send SMS" },
  { permissionName: "Send Bulk SMS" },
  { permissionName: "SMS Info" },
  { permissionName: "Create User" },
  { permissionName: "Create Role" },
  { permissionName: "Create Permission" },
  { permissionName: "Site Information" },
  { permissionName: "Outlet Information" },
];

async function seedPermission() {
  try {
    console.log("🔄 Removing all existing permissions...");
    // await Permission.deleteMany({}); // ✅ Clear the old permissions

    console.log("🌱 Seeding new permissions...");
    await Permission.insertMany(permissionList);

    console.log("✅ Permission seeding completed successfully.");
  } catch (error) {
    console.error("❌ Error while seeding permissions:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return seedPermission();
  })
  .then(() => {
    mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
