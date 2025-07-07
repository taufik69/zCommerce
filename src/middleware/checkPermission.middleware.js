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
    const allowed = req.user.permissions.find((perm) => {
      return (
        perm.slug === moduleName &&
        perm.actions &&
        perm.actions.includes(action)
      );
    });
    console.log(req.user.permissions);
    return;

    if (allowed) {
      // next();
      console.log(
        `User ${req.user.id} is authorized for ${moduleName} - ${action} ${allowed}`
      );
    } else {
      throw new customError(
        "Access denied: You don't have permission to perform this action",
        403
      );
    }
  });

module.exports = { authorize };
