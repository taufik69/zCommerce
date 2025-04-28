const Permission = require("../models/permisson.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");

// Create a new permission
exports.createPermission = async (req, res) => {
  const { name, description } = req.body;

  const permission = new Permission({ name, description });
  await permission.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Permission created successfully",
    permission
  );
};

// Get all permissions
exports.getAllPermissions = async (req, res) => {
  const permissions = await Permission.find();
  return apiResponse.sendSuccess(
    res,
    200,
    "Permissions fetched successfully",
    permissions
  );
};
