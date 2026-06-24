const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../models/user.model");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");

const USERS = [
  {
    name: "Super Admin",
    email: "superadmin@baig.com",
    password: "SuperAdmin@123",
    phone: "01700000001",
    roleSlug: "superadmin",
  },
  {
    name: "Admin",
    email: "admin@baig.com",
    password: "Admin@1234",
    phone: "01700000002",
    roleSlug: "admin",
  },
  {
    name: "Manager",
    email: "manager@baig.com",
    password: "Manager@123",
    phone: "01700000003",
    roleSlug: "manager",
  },
];

async function seedUsers() {
  try {
    for (const u of USERS) {
      const role = await Role.findOne({ slug: u.roleSlug }).populate("permissions.permission");
      if (!role) { console.log(`⚠  Role not found: ${u.roleSlug} — skipping ${u.email}`); continue; }

      // Delete existing user with this email so seeder is re-runnable
      await User.deleteOne({ email: u.email });

      // For superadmin attach all permissions directly; others rely on role only
      let userPermissions = [];
      if (u.roleSlug === "superadmin") {
        const allPerms = await Permission.find({});
        userPermissions = allPerms.map((p) => ({
          permission: p._id,
          actions: ["view", "add", "edit", "delete"],
        }));
      }

      const user = new User({
        name: u.name,
        email: u.email,
        password: u.password,
        phone: u.phone,
        roles: [role._id],
        permissions: userPermissions,
        isActive: true,
      });

      await user.save();
      user.createdBy = user._id;
      await user.save();

      console.log(`✔  Created: ${u.name} | ${u.email} | password: ${u.password}`);
    }

    console.log("\n🎉 Done! User credentials:");
    console.log("─────────────────────────────────────────────");
    for (const u of USERS) {
      console.log(`  ${u.name.padEnd(12)} | ${u.email.padEnd(22)} | ${u.password}`);
    }
    console.log("─────────────────────────────────────────────");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return seedUsers();
  })
  .then(() => {
    mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
