const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const Role = require("../models/role.model");
const { customError } = require("../lib/CustomError");

const defaultRole = [
  {
    name: "superAdmin",
    slug: "superadmin",
    isActive: true,
  },
  {
    name: "admin",
    slug: "admin",
    isActive: true,
  },
  {
    name: "user",
    slug: "user",
    isActive: true,
  },
  {
    name: "manager",
    slug: "manager",
    isActive: true,
  },
  {
    name: "guest",
    slug: "guest",
    isActive: true,
  },
  {
    name: "salesMen",
    slug: "salesmen",
    isActive: true,
  },
];

const roleSeeder = async () => {
  try {
    console.log("All roles deleted successfully.");

    const existingRoles = await Role.find();
    if (existingRoles.length > 0) {
      console.log("Roles already exist, skipping seeding.");
      return;
    }

    await Role.insertMany(defaultRole);
    console.log("Default roles seeded successfully.");
  } catch (error) {
    throw new customError("Error seeding roles: " + error.message, 500);
  }
};

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return roleSeeder();
  })
  .then(() => {
    console.log("Role seeding completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB while seeding roles:", err);
    process.exit(1);
  });
