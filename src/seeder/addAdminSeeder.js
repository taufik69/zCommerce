const Permission = require("../models/permisson.model");
const { customError } = require("../lib/CustomError");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

async function seedSuperAdmin() {
  try {
    // delete existing superadmin users
    await User.deleteMany({ email: "superadmin@gmail.com" });
    console.log("Cleared existing superadmin users.");
    // Check existing permissions
    const allPermissions = await Permission.find({});
    if (allPermissions?.length === 0) {
      console.log(" first seed roles and permissions");
      return;
    }
    const roles = await Role.find({ slug: "superadmin" });
    if (roles.length === 0) {
      throw new customError(
        "Superadmin role not found. Please seed roles first.",
        500
      );
    }
    // now crate super admin user
    const superAdminUser = await User.findOne({ email: "superadmin" });
    if (superAdminUser) {
      apiResponse.sendSuccess(res, 200, "Superadmin user already exists");
    }
    const superAdmin = new User({
      email: "superadmin@gmail.com",
      name: "superadmin",
      password: "Sadmin@123",
      image: null,
      roles: roles.map((role) => role._id),
      permissions: allPermissions.map((permission) => ({
        permission: permission._id,
        actions: ["view", "add", "edit", "delete"],
      })),
      isActive: true,
    });
    if (!superAdmin) {
      throw new customError("Superadmin user creation failed.", 500);
    }

    await superAdmin.save();
    // now superadmin id added  to createdBy
    superAdmin.createdBy = superAdmin._id;
    await superAdmin.save();
    console.log("Superadmin user created successfully.");
  } catch (error) {
    throw new customError("Error seeding superadmin: " + error.message, 500);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return seedSuperAdmin();
  })
  .then(() => {
    console.log("Superadmin seeding completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB or seeding superadmin:", err);
    process.exit(1);
  });
