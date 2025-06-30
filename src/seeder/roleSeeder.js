const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const { customError } = require("../lib/CustomError");

async function seedSuperAdminRole() {
  await mongoose.connect(process.env.DATABASE_URL);

  // 1. Get all permissions
  const allPermissions = await Permission.find({});
  const allPermissionIds = allPermissions.map((p) => p._id);

  // 2. Create or update superAdmin role
  await Role.findOneAndUpdate(
    { name: "superAdmin" },
    {
      name: "superAdmin",
      permissions: allPermissionIds,
      isActive: true,
    },
    { upsert: true, new: true } // upsert creates the role if it doesn't exist
  );

  console.log("SuperAdmin role seeded with all permissions.");
  await mongoose.disconnect();
}

seedSuperAdminRole().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  throw new customError("Failed to seed SuperAdmin role", 500);
});
