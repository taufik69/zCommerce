const Role = require("../models/role.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Create a new role
exports.createRole = async (req, res) => {
  const { name } = req.body;

  const role = new Role({ name });
  await role.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Role created successfully",
    role,
  );
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  const roles = await Role.find();
  if (!roles) throw new customError("Roles not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Roles fetched successfully",
    roles,
  );
};

// Get a single role
exports.getRoleByslug = async (req, res) => {
  if (!req.params.slug) {
    throw new customError("Role Name not Found ", statusCodes.NOT_FOUND);
  }
  const role = await Role.findOne({ slug: req.params.slug }).sort({
    createdAt: -1,
  });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Role fetched successfully",
    role,
  );
};

// Update a role
exports.updateRole = async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("Role slug not provided", statusCodes.BAD_REQUEST);
  }
  const updates = req.body;

  const role = await Role.findOneAndUpdate({ slug }, updates, { new: true });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Role updated successfully",
    role,
  );
};

// Delete a role
exports.deleteRole = async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("Role slug not provided", statusCodes.BAD_REQUEST);
  }
  const role = await Role.findOneAndDelete({ slug: slug });
  if (!role) throw new customError("Role not found", statusCodes.NOT_FOUND);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Role deleted successfully",
    role,
  );
};
