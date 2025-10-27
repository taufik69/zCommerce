const { customError } = require("../lib/CustomError");
const User = require("../models/user.model");
const Permission = require("../models/permisson.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

// get all permissions
exports.getAllPermissions = asynchandeler(async (req, res) => {
  const permissions = await Permission.find({ isActive: true }).sort({
    permissionName: 1,
  });

  apiResponse.sendSuccess(
    res,
    200,
    "Permissions fetched successfully",
    permissions
  );
});

// ===============================
// 2. Get all users (User dropdown এর জন্য)
// ===============================
exports.getAllUsers = asynchandeler(async (req, res) => {
  const users = await User.find({ isActive: true })
    .select("name email phone")
    .sort({ name: 1 });

  if (!users || users.length === 0) {
    throw new customError("No active users found", 404);
  }

  apiResponse.sendSuccess(res, 200, "Users fetched successfully", users);
});

// ===============================
// Get specific user's permissions and actions
// ===============================
exports.getUserPermissions = asynchandeler(async (req, res) => {
  const { userId } = req.params;

  // ✅ Find user and populate permissions
  const user = await User.findById(userId)
    .populate("permissions")
    .select("name email permissions");

  if (!user) {
    throw new customError("User not found", 404);
  }

  // ✅ Fetch all active permissions
  const allPermissions = await Permission.find({ isActive: true }).sort({
    permissionName: 1,
  });

  // ✅ Format permissions
  const formattedPermissions = allPermissions.map((permission) => {
    const userHasPermission = user.permissions.some(
      (p) => p._id.toString() === permission._id.toString()
    );

    if (userHasPermission) {
      const userPermission = user.permissions.find(
        (p) => p._id.toString() === permission._id.toString()
      );

      return {
        _id: permission._id,
        permissionName: permission.permissionName,
        slug: permission.slug,
        actions: userPermission.actions || [],
        hasPermission: true,
      };
    } else {
      return {
        _id: permission._id,
        permissionName: permission.permissionName,
        slug: permission.slug,
        actions: [],
        hasPermission: false,
      };
    }
  });

  // ✅ Send response
  apiResponse.sendSuccess(res, 200, "User permissions fetched successfully", {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
    },
    permissions: formattedPermissions,
  });
});

// ===============================
// Bulk update user permissions (Save button)
// ===============================
exports.updateUserPermissions = asynchandeler(async (req, res) => {
  const { userId } = req.params;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    throw new customError("Permissions array is required", 400);
  }

  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", 404);

  // Prepare permissions array for user
  const userPermissions = [];

  for (const perm of permissions) {
    if (!perm.permissionId || !perm.actions || !perm.actions.length) continue;

    // Ensure permission exists
    const permission = await Permission.findById(perm.permissionId);
    if (!permission) continue;

    // Save _id + actions in user.permissions
    userPermissions.push({
      permission: permission._id,
      actions: perm.actions,
      Options: perm.Options || [],
      Reports: perm.Reports || [],
    });
  }

  user.permissions = userPermissions;
  user.createdBy = req.user?.id;
  await user.save();

  const updatedUser = await User.findById(userId)
    .populate("permissions")
    .select("name email permissions");

  apiResponse.sendSuccess(res, 200, "User permissions updated successfully", {
    user: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
    },
  });
});

// ===============================
// Grant all permissions to a user
// ===============================
exports.grantAllPermissions = asynchandeler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", 404);

  // Fetch all active permissions
  const allPermissions = await Permission.find({ isActive: true });

  // Assign all permissions to user
  user.permissions = allPermissions.map((p) => ({
    permission: p._id,
    actions: ["view", "add", "update", "delete"], // if you want default actions
  }));

  await user.save();

  apiResponse.sendSuccess(res, 200, "All permissions granted successfully", {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
    },
    permissions: user.permissions,
  });
});
