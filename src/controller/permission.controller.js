const Permission = require("../models/permisson.model");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const validatePermission = require("../validation/permission.validation");
const { statusCodes } = require("../constant/constant");
const { asynchandeler } = require("../lib/asyncHandeler");

// Create a new permission
exports.createPermission = asynchandeler(async (req, res) => {
  const { permissionName, actions } = await validatePermission(req);

  const permission = new Permission({ permissionName, actions });
  await permission.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Permission created successfully",
    permission,
  );
});

// Get all permissions
exports.getAllPermissions = asynchandeler(async (req, res) => {
  const permissions = await Permission.find().sort({ createdAt: 1 });
  if (!permissions || permissions.length === 0)
    throw new customError("Permissions not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permissions fetched successfully",
    permissions,
  );
});

// get single permission using slug
exports.getPermissionBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const permission = await Permission.findOne({ slug: slug });
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission fetched successfully",
    permission,
  );
});

// update permission using slug
exports.updatePermission = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const permission = await Permission.findOneAndUpdate(
    { slug: slug },
    { ...req.body },
    { new: true },
  );
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission updated successfully",
    permission,
  );
});

// search permission using slug and update isActive field to false
exports.deactivatePermission = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const permission = await Permission.findOneAndUpdate(
    { slug: slug },
    { isActive: false },
    { new: true },
  );
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission deactivated  successfully",
    permission,
  );
});

//active permission using slug
exports.activePermission = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const permission = await Permission.findOneAndUpdate(
    { slug: slug },
    { isActive: true },
    { new: true },
  );
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission activated  successfully",
    permission,
  );
});

//delete permisson using slug
exports.deletePermission = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const permission = await Permission.findOneAndDelete({ slug: slug });
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission deleted successfully",
    permission,
  );
});
