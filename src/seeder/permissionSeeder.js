const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const permission = [
  { permissionName: "Product", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Category", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Order", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Discount", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Variant", actions: ["view", "add", "delete", "update"] },
  {
    permissionName: "SubCategory",
    actions: ["view", "add", "delete", "update"],
  },
  { permissionName: "Brand", actions: ["view", "add", "delete", "update"] },
  {
    permissionName: "productInventory",
    actions: ["view", "add", "delete", "update"],
  },
  {
    permissionName: "RawProduct",
    actions: ["view", "add", "delete", "update"],
  },
  {
    permissionName: "ProductionStuff",
    actions: ["view", "add", "delete", "update"],
  },
  { permissionName: "Purchase", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Sales", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Stock", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Customer", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Supplier", actions: ["view", "add", "delete", "update"] },
  { permissionName: "Employee", actions: ["view", "add", "delete", "update"] },
  {
    permissionName: "Attendance",
    actions: ["view", "add", "delete", "update"],
  },
  { permissionName: "Sms", actions: ["view", "add", "delete", "update"] },
  {
    permissionName: "UserRoleAndPermission",
    actions: ["view", "add", "delete", "update"],
  },
  { permissionName: "Settings", actions: ["view", "add", "delete", "update"] },
  {
    permissionName: "Notification",
    actions: ["view", "add", "delete", "update"],
  },
  { permissionName: "Report", actions: ["view", "add", "delete", "update"] },
];

async function seedPermisson() {
  try {
    await Permission.deleteMany({});
    console.log("All permissions deleted.");

    // Check if permissions already exist
    // const existingPermissions = await Permission.find();
    // if (existingPermissions.length > 0) {
    //   console.log("Permissions already seeded.");
    //   return;
    // }

    // Insert permissions
    // await Permission.insertMany(permission);
    // console.log("Permissions seeded successfully.");
    //now delete all permissions

    // If you want to drop the index, uncomment the following line
    // await mongoose.connection
    //   .collection("permissions")
    //   .dropIndex("PermissionName_1");
    const existingPermissions = await Permission.find({});
    if (existingPermissions?.length > 0) {
      console.log("Permissions already seeded.");
      // await Permission.deleteMany({});
      // console.log("All permissions deleted.");
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
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error(
      "Error connecting to MongoDB While permissions seeding:",
      err
    );
    process.exit(1);
  });
