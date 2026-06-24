const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

const authorize = (moduleName, action) =>
  asynchandeler(async (req, res, next) => {
    if (!req.user || !req.user.id) {
      throw new customError("Unauthorized: User not found in request", statusCodes.UNAUTHORIZED);
    }

    // Superadmin bypasses all checks
    const isSuperAdmin = req.user?.roles?.some((role) => role.slug === "superadmin");
    if (isSuperAdmin) return next();

    const module = moduleName?.toString()?.toLowerCase();
    const effectiveActions = new Set();

    // 1. Collect role-level permissions (union)
    for (const role of (req.user.roles || [])) {
      if (!role.isActive) continue;
      for (const p of (role.permissions || [])) {
        if (p.permission?.slug === module) {
          p.actions.forEach((a) => effectiveActions.add(a));
        }
      }
    }

    // 2. Union with user-level permissions (most permissive wins)
    for (const p of (req.user.permissions || [])) {
      if (p.permission?.slug === module) {
        p.actions.forEach((a) => effectiveActions.add(a));
      }
    }

    if (effectiveActions.has(action)) {
      return next();
    }

    throw new customError(
      `Access denied: User "${req.user.name}" is not authorized for ${moduleName}:${action}`,
      statusCodes.FORBIDDEN
    );
  });

module.exports = { authorize };
