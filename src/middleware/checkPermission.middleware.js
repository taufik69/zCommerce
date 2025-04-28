const User = require("../models/user.model");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const { customError } = require("../lib/CustomError");

exports.checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    const user = await User.findById(req.user.id).populate("roles");
    if (!user) throw new customError("User not found", 404);

    const userPermissions = new Set();

    for (const role of user.roles) {
      const populatedRole = await Role.findById(role._id).populate(
        "permissions"
      );
      populatedRole.permissions.forEach((permission) =>
        userPermissions.add(permission.name)
      );
    }

    if (!userPermissions.has(requiredPermission)) {
      throw new customError("Access denied", 403);
    }

    next();
  };
};
