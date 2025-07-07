const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { custom } = require("joi");

const authorize = (moduleName, action) =>
  asynchandeler(async (req, res, next) => {
    // Ensure req.user is set by auth middleware
    if (!req.user || !req.user.id) {
      throw new customError("Unauthorized: User not found in request", 401);
    }

    // Superadmin shortcut
    const isSuperAdmin = req.user?.roles?.some(
      (role) => role.slug === "superadmin"
    );
    if (isSuperAdmin) return next();

    // Check permissions
    const allowed = req.user?.permissions?.find((perm) => {
      return (
        perm.slug === moduleName?.toString()?.toLowerCase() &&
        perm.actions &&
        perm.actions.includes(action)
      );
    });

    if (allowed) {
      // If permission is found, proceed to the next middleware
      next();
    } else {
      throw new customError(
        "Access denied: You don't have permission to perform this action || " +
          `User ${req.user.name} is Not authorized for ${moduleName} - ${action} action`,
        403
      );
    }
  });

module.exports = { authorize };
