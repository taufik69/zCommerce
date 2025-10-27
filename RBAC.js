// ===============================
// 1. MODELS (Database Schemas)
// ===============================

// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Password verification method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

// models/Role.js
const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Role", roleSchema);

// models/Permission.js
const permissionSchema = new mongoose.Schema({
  resource: { type: String, required: true }, // 'users', 'products', 'orders'
  actions: [{ type: String, enum: ["create", "read", "update", "delete"] }],
  description: String,
});

module.exports = mongoose.model("Permission", permissionSchema);

// ===============================
// 2. MIDDLEWARE (Authorization)
// ===============================

// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// JWT verification middleware
exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid user" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Middleware to check user permissions
exports.authorize = (resource, action) => {
  return (req, res, next) => {
    const userPermissions = req.user.role.permissions;

    // Check if the user has the required permission
    const hasPermission = userPermissions.some(
      (permission) =>
        permission.resource === resource && permission.actions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({
        message: `You don't have permission to ${action} ${resource}`,
      });
    }

    next();
  };
};

// Middleware to check for specific roles
exports.checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role.name)) {
      return res.status(403).json({
        message: "Access denied for your role",
      });
    }
    next();
  };
};

// ===============================
// 3. CONTROLLERS (Business Logic)
// ===============================

// controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");

// User Registration
exports.register = async (req, res) => {
  try {
    const { name, email, password, roleName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Find role
    const role = await Role.findOne({ name: roleName || "User" });
    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Create user
    const user = new User({ name, email, password, role: role._id });
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: { name: user.name, email: user.email, role: role.name },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).populate("role");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// controllers/userController.js
// Get all users (Only Admin can perform this)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate("role").select("-password");
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Update user (Manager and Admin can perform this)
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    res.json({ message: "User updated", user });
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

// Delete user (Only Admin can perform this)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndDelete(userId);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};
