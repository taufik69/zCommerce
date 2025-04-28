const User = require("../models/user.model");
const Role = require("../models/role.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");

// Create a new user
exports.createUser = async (req, res) => {
  const { name, email, password, roles } = req.body;

  const user = new User({ name, email, password, roles });
  await user.save();

  return apiResponse.sendSuccess(res, 201, "User created successfully", user);
};

// Get all users
exports.getAllUsers = async (req, res) => {
  const users = await User.find().populate("roles");
  return apiResponse.sendSuccess(res, 200, "Users fetched successfully", users);
};

// Get a single user
exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).populate("roles");
  if (!user) throw new customError("User not found", 404);

  return apiResponse.sendSuccess(res, 200, "User fetched successfully", user);
};

// Update a user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const user = await User.findByIdAndUpdate(id, updates, { new: true });
  if (!user) throw new customError("User not found", 404);

  return apiResponse.sendSuccess(res, 200, "User updated successfully", user);
};

// Delete a user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);
  if (!user) throw new customError("User not found", 404);

  return apiResponse.sendSuccess(res, 200, "User deleted successfully", user);
};
