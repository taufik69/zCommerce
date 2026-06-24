const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");

// ---------- Permission assignments per role ----------
// Format: { roleSlug: { permissionName: [actions] } }

const ROLE_PERMISSIONS = {

  // superadmin — gets everything via code bypass, but we seed anyway for completeness
  superadmin: {
    "Product":                    ["view", "add", "edit", "delete"],
    "Category":                   ["view", "add", "edit", "delete"],
    "Sub Category":               ["view", "add", "edit", "delete"],
    "Brand":                      ["view", "add", "edit", "delete"],
    "Size Chart":                 ["view", "add", "edit", "delete"],
    "Variant":                    ["view", "add", "edit", "delete"],
    "Purchase":                   ["view", "add", "edit", "delete"],
    "Purchase Return":            ["view", "add", "edit", "delete"],
    "Delivery Charge":            ["view", "add", "edit", "delete"],
    "Discount":                   ["view", "add", "edit", "delete"],
    "Discount Banner":            ["view", "add", "edit", "delete"],
    "Coupon":                     ["view", "add", "edit", "delete"],
    "Order":                      ["view", "add", "edit", "delete"],
    "Incomplete Order":           ["view", "add", "edit", "delete"],
    "Courier Merchant":           ["view", "add", "edit", "delete"],
    "Courier Delivery":           ["view", "add", "edit", "delete"],
    "Courier Return":             ["view", "add", "edit", "delete"],
    "View All Stock":             ["view", "add", "edit", "delete"],
    "Stock Adjustment":           ["view", "add", "edit", "delete"],
    "Category Stock Details":     ["view", "add", "edit", "delete"],
    "Size & Color Wise Stock":    ["view", "add", "edit", "delete"],
    "Size Wise Stock":            ["view", "add", "edit", "delete"],
    "Low Stock":                  ["view", "add", "edit", "delete"],
    "Add Transaction":            ["view", "add", "edit", "delete"],
    "Transaction Category":       ["view", "add", "edit", "delete"],
    "Add Account":                ["view", "add", "edit", "delete"],
    "Money Transfer":             ["view", "add", "edit", "delete"],
    "Money Handover":             ["view", "add", "edit", "delete"],
    "Send SMS":                   ["view", "add", "edit", "delete"],
    "Send Bulk SMS":              ["view", "add", "edit", "delete"],
    "SMS Info":                   ["view", "add", "edit", "delete"],
    "Employee":                   ["view", "add", "edit", "delete"],
    "Designation":                ["view", "add", "edit", "delete"],
    "Department":                 ["view", "add", "edit", "delete"],
    "Section":                    ["view", "add", "edit", "delete"],
    "Supplier":                   ["view", "add", "edit", "delete"],
    "Supplier Payment":           ["view", "add", "edit", "delete"],
    "Customer Type":              ["view", "add", "edit", "delete"],
    "Customer":                   ["view", "add", "edit", "delete"],
    "Customer Payment":           ["view", "add", "edit", "delete"],
    "Advance Payment":            ["view", "add", "edit", "delete"],
    "Retail Sales":               ["view", "add", "edit", "delete"],
    "Sales History":              ["view", "add", "edit", "delete"],
    "Purchase Invoice":           ["view", "add", "edit", "delete"],
    "Purchase Summary":           ["view", "add", "edit", "delete"],
    "Purchase Return Report":     ["view", "add", "edit", "delete"],
    "Order Invoice":              ["view", "add", "edit", "delete"],
    "Order Status Report":        ["view", "add", "edit", "delete"],
    "Transaction Report":         ["view", "add", "edit", "delete"],
    "Transaction Summary":        ["view", "add", "edit", "delete"],
    "Cash Ledger":                ["view", "add", "edit", "delete"],
    "Transaction Account Wise":   ["view", "add", "edit", "delete"],
    "Account Transaction Summary":["view", "add", "edit", "delete"],
    "Account Balance":            ["view", "add", "edit", "delete"],
    "Fund Handover":              ["view", "add", "edit", "delete"],
    "Create Banner":              ["view", "add", "edit", "delete"],
    "Site Information":           ["view", "add", "edit", "delete"],
    "Outlet Information":         ["view", "add", "edit", "delete"],
    "Create User":                ["view", "add", "edit", "delete"],
    "Create Role":                ["view", "add", "edit", "delete"],
    "Create Permission":          ["view", "add", "edit", "delete"],
  },

  // admin — full access except user/role/permission management (delete restricted)
  admin: {
    "Product":                    ["view", "add", "edit", "delete"],
    "Category":                   ["view", "add", "edit", "delete"],
    "Sub Category":               ["view", "add", "edit", "delete"],
    "Brand":                      ["view", "add", "edit", "delete"],
    "Size Chart":                 ["view", "add", "edit", "delete"],
    "Variant":                    ["view", "add", "edit", "delete"],
    "Purchase":                   ["view", "add", "edit", "delete"],
    "Purchase Return":            ["view", "add", "edit", "delete"],
    "Delivery Charge":            ["view", "add", "edit"],
    "Discount":                   ["view", "add", "edit", "delete"],
    "Discount Banner":            ["view", "add", "edit", "delete"],
    "Coupon":                     ["view", "add", "edit", "delete"],
    "Order":                      ["view", "add", "edit", "delete"],
    "Incomplete Order":           ["view", "edit"],
    "Courier Merchant":           ["view", "add", "edit"],
    "Courier Delivery":           ["view", "edit"],
    "Courier Return":             ["view", "edit"],
    "View All Stock":             ["view"],
    "Stock Adjustment":           ["view", "add", "edit"],
    "Category Stock Details":     ["view"],
    "Size & Color Wise Stock":    ["view"],
    "Size Wise Stock":            ["view"],
    "Low Stock":                  ["view"],
    "Add Transaction":            ["view", "add", "edit", "delete"],
    "Transaction Category":       ["view", "add", "edit", "delete"],
    "Add Account":                ["view", "add", "edit"],
    "Money Transfer":             ["view", "add", "edit"],
    "Money Handover":             ["view", "add", "edit"],
    "Send SMS":                   ["view", "add"],
    "Send Bulk SMS":              ["view", "add"],
    "SMS Info":                   ["view"],
    "Employee":                   ["view", "add", "edit", "delete"],
    "Designation":                ["view", "add", "edit", "delete"],
    "Department":                 ["view", "add", "edit", "delete"],
    "Section":                    ["view", "add", "edit", "delete"],
    "Supplier":                   ["view", "add", "edit", "delete"],
    "Supplier Payment":           ["view", "add", "edit"],
    "Customer Type":              ["view", "add", "edit", "delete"],
    "Customer":                   ["view", "add", "edit", "delete"],
    "Customer Payment":           ["view", "add", "edit"],
    "Advance Payment":            ["view", "add", "edit"],
    "Retail Sales":               ["view", "add", "edit", "delete"],
    "Sales History":              ["view"],
    "Purchase Invoice":           ["view"],
    "Purchase Summary":           ["view"],
    "Purchase Return Report":     ["view"],
    "Order Invoice":              ["view"],
    "Order Status Report":        ["view"],
    "Transaction Report":         ["view"],
    "Transaction Summary":        ["view"],
    "Cash Ledger":                ["view"],
    "Transaction Account Wise":   ["view"],
    "Account Transaction Summary":["view"],
    "Account Balance":            ["view"],
    "Fund Handover":              ["view"],
    "Create Banner":              ["view", "add", "edit", "delete"],
    "Site Information":           ["view", "edit"],
    "Outlet Information":         ["view", "edit"],
    "Create User":                ["view", "add", "edit"],
    "Create Role":                ["view"],
    "Create Permission":          ["view"],
  },

  // manager — day-to-day operations: sales, orders, stock, customers, reports
  manager: {
    "Product":                    ["view", "add", "edit"],
    "Category":                   ["view"],
    "Sub Category":               ["view"],
    "Brand":                      ["view"],
    "Size Chart":                 ["view"],
    "Variant":                    ["view", "add", "edit"],
    "Purchase":                   ["view", "add", "edit"],
    "Purchase Return":            ["view", "add"],
    "Delivery Charge":            ["view"],
    "Discount":                   ["view", "add", "edit"],
    "Coupon":                     ["view", "add", "edit"],
    "Order":                      ["view", "edit"],
    "Incomplete Order":           ["view"],
    "Courier Delivery":           ["view", "edit"],
    "Courier Return":             ["view"],
    "View All Stock":             ["view"],
    "Stock Adjustment":           ["view", "add"],
    "Category Stock Details":     ["view"],
    "Size & Color Wise Stock":    ["view"],
    "Size Wise Stock":            ["view"],
    "Low Stock":                  ["view"],
    "Add Transaction":            ["view", "add"],
    "Transaction Category":       ["view"],
    "Add Account":                ["view"],
    "Money Transfer":             ["view"],
    "Money Handover":             ["view"],
    "Send SMS":                   ["view", "add"],
    "Send Bulk SMS":              ["view", "add"],
    "SMS Info":                   ["view"],
    "Supplier":                   ["view"],
    "Customer Type":              ["view"],
    "Customer":                   ["view", "add", "edit"],
    "Customer Payment":           ["view", "add"],
    "Retail Sales":               ["view", "add", "edit"],
    "Sales History":              ["view"],
    "Purchase Invoice":           ["view"],
    "Purchase Summary":           ["view"],
    "Order Invoice":              ["view"],
    "Order Status Report":        ["view"],
    "Transaction Report":         ["view"],
    "Transaction Summary":        ["view"],
    "Cash Ledger":                ["view"],
  },

  // user — basic view + sales only
  user: {
    "Product":                    ["view"],
    "Category":                   ["view"],
    "Sub Category":               ["view"],
    "Brand":                      ["view"],
    "Variant":                    ["view"],
    "Order":                      ["view"],
    "View All Stock":             ["view"],
    "Low Stock":                  ["view"],
    "Customer":                   ["view", "add"],
    "Retail Sales":               ["view", "add"],
    "Sales History":              ["view"],
    "Order Invoice":              ["view"],
  },

};

// ---------- Seeder ----------
async function seedRolePermissions() {
  try {
    let totalUpdated = 0;

    for (const [roleSlug, permMap] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await Role.findOne({ slug: roleSlug });
      if (!role) {
        console.log(`⚠  Role not found: ${roleSlug} — skipping`);
        continue;
      }

      const assignments = [];

      for (const [permName, actions] of Object.entries(permMap)) {
        const perm = await Permission.findOne({ permissionName: permName });
        if (!perm) {
          console.log(`   ⚠  Permission not found: "${permName}" — skipping`);
          continue;
        }
        assignments.push({ permission: perm._id, actions });
      }

      role.permissions = assignments;
      await role.save();
      console.log(`✔  ${roleSlug} — assigned ${assignments.length} permissions`);
      totalUpdated++;
    }

    console.log(`\n🎉 Done! Updated ${totalUpdated} roles.`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return seedRolePermissions();
  })
  .then(() => {
    mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  })
  .catch((err) => {
    console.error("❌ Error connecting to MongoDB:", err);
    process.exit(1);
  });
