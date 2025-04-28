const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");

// Create a new role
exports.createRole = async (req, res) => {
  const { name, permissions } = req.body;

  const role = new Role({ name, permissions });
  await role.save();

  return apiResponse.sendSuccess(res, 201, "Role created successfully", role);
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  const roles = await Role.find().populate("permissions");
  return apiResponse.sendSuccess(res, 200, "Roles fetched successfully", roles);
};

// Get a single role
exports.getRoleById = async (req, res) => {
  const role = await Role.findById(req.params.id).populate("permissions");
  if (!role) throw new customError("Role not found", 404);

  return apiResponse.sendSuccess(res, 200, "Role fetched successfully", role);
};

// Update a role
exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const role = await Role.findByIdAndUpdate(id, updates, { new: true });
  if (!role) throw new customError("Role not found", 404);

  return apiResponse.sendSuccess(res, 200, "Role updated successfully", role);
};

// Delete a role
exports.deleteRole = async (req, res) => {
  const { id } = req.params;

  const role = await Role.findByIdAndDelete(id);
  if (!role) throw new customError("Role not found", 404);

  return apiResponse.sendSuccess(res, 200, "Role deleted successfully", role);
};
