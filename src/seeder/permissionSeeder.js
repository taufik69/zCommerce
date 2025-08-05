const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const permission = [
  { permissionName: "Product", actions: ["view"] },
  { permissionName: "Category", actions: ["view"] },
  { permissionName: "Order", actions: ["view"] },
  { permissionName: "Discount", actions: ["view"] },
  { permissionName: "Variant", actions: ["view"] },
  { permissionName: "SubCategory", actions: ["view"] },
  { permissionName: "Brand", actions: ["view"] },
  { permissionName: "productInventory", actions: ["view"] },
  { permissionName: "RawProduct", actions: ["view"] },
  { permissionName: "ProductionStuff", actions: ["view"] },
  { permissionName: "Purchase", actions: ["view"] },
  { permissionName: "Sales", actions: ["view"] },
  { permissionName: "Stock", actions: ["view"] },
  { permissionName: "user", actions: ["view"] },
  { permissionName: "Supplier", actions: ["view"] },
  { permissionName: "Employee", actions: ["view"] },
  { permissionName: "Attendance", actions: ["view"] },
  { permissionName: "Sms", actions: ["view"] },
  { permissionName: "UserRoleAndPermission", actions: ["view"] },
  { permissionName: "Settings", actions: ["view"] },
  { permissionName: "Notification", actions: ["view"] },
  { permissionName: "Report", actions: ["view"] },
];

/**
 * Seeds the database with default permissions.
 *
 * This function deletes all existing permissions and then checks if any permissions exist.
 * If permissions already exist, it logs a message and exits. Otherwise, it inserts a predefined
 * list of permissions into the database. If a permission already exists, it skips seeding for
 * that permission. Logs success or existence messages for each permission.
 *
 * If any error occurs during the seeding process, it logs the error.
 */

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
    console.log("Permission seeding completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB or seeding permissions:", err);
    process.exit(1);
  });
