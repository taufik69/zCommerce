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

// ===============================
// 4. ROUTES (API Endpoints)
// ===============================

// routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;

// routes/users.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authenticate, authorize, checkRole } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Get all users - requires 'read' permission for 'users' resource
router.get("/", authorize("users", "read"), userController.getAllUsers);

// Update user - requires 'update' permission for 'users' resource
router.put("/:userId", authorize("users", "update"), userController.updateUser);

// Delete user - only 'Admin' role can perform this
router.delete(
  "/:userId",
  checkRole("Admin"),
  authorize("users", "delete"),
  userController.deleteUser
);

module.exports = router;

// ===============================
// 5. MAIN APP (Server Setup)
// ===============================

// app.js
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");

const app = express();

// Middleware
app.use(express.json());

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ===============================
// 6. DATABASE SEEDING (Initial Data)
// ===============================

// seed.js - To create initial roles and permissions
const mongoose = require("mongoose");
const Permission = require("./models/Permission");
const Role = require("./models/Role");

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Clear existing data
    await Permission.deleteMany({});
    await Role.deleteMany({});

    // Create Permissions
    const permissions = await Permission.insertMany([
      { resource: "users", actions: ["create", "read", "update", "delete"] },
      { resource: "products", actions: ["create", "read", "update", "delete"] },
      { resource: "orders", actions: ["read", "update"] },
    ]);

    // Create Roles with Permissions
    await Role.create([
      {
        name: "Admin",
        description: "Full system access",
        permissions: permissions.map((p) => p._id), // All permissions
      },
      {
        name: "Manager",
        description: "Manage products and orders",
        permissions: [permissions[1]._id, permissions[2]._id], // products and orders
      },
      {
        name: "User",
        description: "Basic user access",
        permissions: [
          permissions.find(
            (p) => p.resource === "products" && p.actions.includes("read")
          )?._id,
        ],
      },
    ]);

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();

// ===============================
// 7. USAGE EXAMPLES
// ===============================

/*
API Testing Examples:

1. Register a new user:
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "roleName": "Manager"
}

2. Login:
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}

Response: { "token": "jwt_token_here" }

3. Get all users (Admin only):
GET /api/users
Headers: { "Authorization": "Bearer jwt_token_here" }

4. Update user (Manager/Admin):
PUT /api/users/:userId
Headers: { "Authorization": "Bearer jwt_token_here" }
{
  "name": "Updated Name"
}

5. Delete user (Admin only):
DELETE /api/users/:userId
Headers: { "Authorization": "Bearer jwt_token_here" }
*/
