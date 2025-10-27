const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const permission = [
  { permissionName: "Product" },
  { permissionName: "Category" },
  { permissionName: "Order" },
  { permissionName: "Discount" },
  { permissionName: "Variant" },
  { permissionName: "SubCategory" },
  { permissionName: "Brand" },
  { permissionName: "productInventory" },
  { permissionName: "RawProduct" },
  { permissionName: "ProductionStuff" },
  { permissionName: "Purchase" },
  { permissionName: "Sales" },
  { permissionName: "Stock" },
  { permissionName: "user" },
  { permissionName: "Supplier" },
  { permissionName: "Employee" },
  { permissionName: "Attendance" },
  { permissionName: "Sms" },
  { permissionName: "UserRoleAndPermission" },
  { permissionName: "Settings" },
  { permissionName: "Notification" },
  { permissionName: "Report" },
];

async function seedPermisson() {
  try {
    console.log("Cleared existing permissions.");
    // Check existing permissions
    const existingPermissions = await Permission.find({});
    if (existingPermissions?.length > 0) {
      console.log("Permissions already seeded.");
      return;
    }

    for (const perm of permission) {
      const existingPermission = await Permission.findOne({
        permissionName: perm.permissionName,
      });

      if (!existingPermission) {
        const newPermission = new Permission(perm);
        await newPermission.save();
        console.log(`Permission ${perm.permissionName} seeded successfully.`);
      } else {
        console.log(`Permission ${perm.permissionName} already exists.`);
      }
    }
  } catch (error) {
    console.error("Error seeding permissions:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return seedPermisson();
  })
  .then(() => {
    console.log("Permission seeding completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB or seeding permissions:", err);
    process.exit(1);
  });
