const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

const authorize = (moduleName, action) =>
  asynchandeler(async (req, res, next) => {
    // Ensure req.user is set by auth middleware
    if (!req.user || !req.user.id) {
      throw new customError("Unauthorized: User not found in request", 401);
    }

    // Populate roles and permissions
    const user = await User.findById(req.user._id).populate({
      path: "roles",
      populate: { path: "permissions" },
    });

    if (!user) {
      throw new customError("Unauthorized: User not found", 401);
    }

    if (!user.roles || user.roles.length === 0) {
      throw new customError("Access denied: No roles assigned", 403);
    }

    // Superadmin shortcut
    const isSuperAdmin = user.roles.some((role) => role.name === "superadmin");
    if (isSuperAdmin) return next();

    // Check permissions
    const allowed = user.roles.some(
      (role) =>
        Array.isArray(role.permissions) &&
        role.permissions.some(
          (permission) =>
            permission.module === moduleName &&
            Array.isArray(permission.actions) &&
            permission.actions.includes(action)
        )
    );

    if (!allowed) {
      throw new customError("Access denied: Insufficient permission", 403);
    }

    next();
  });

module.exports = authorize;
