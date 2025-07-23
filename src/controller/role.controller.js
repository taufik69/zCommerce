const Role = require("../models/role.model");

const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");

// Create a new role
exports.createRole = async (req, res) => {
  const { name } = req.body;

  const role = new Role({ name });
  await role.save();

   apiResponse.sendSuccess(res, 201, "Role created successfully", role);
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  const roles = await Role.find();
   apiResponse.sendSuccess(res, 200, "Roles fetched successfully", roles);
};

// Get a single role
exports.getRoleByslug = async (req, res) => {
  if (!req.params.slug) {
    throw new customError("Role Name not Found ", 404);
  }
  const role = await Role.findOne({ slug: req.params.slug }).sort({
    createdAt: -1,
  });
  if (!role) throw new customError("Role not found", 404);
   apiResponse.sendSuccess(res, 200, "Role fetched successfully", role);
};

// Update a role
exports.updateRole = async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("Role slug not provided", 400);
  }
  const updates = req.body;

  const role = await Role.findOneAndUpdate({ slug }, updates, { new: true });
  if (!role) throw new customError("Role not found", 404);

   apiResponse.sendSuccess(res, 200, "Role updated successfully", role);
};

// Delete a role
exports.deleteRole = async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("Role slug not provided", 400);
  }
  const role = await Role.findOneAndDelete({ slug: slug });
  if (!role) throw new customError("Role not found", 404);

   apiResponse.sendSuccess(res, 200, "Role deleted successfully", role);
};
