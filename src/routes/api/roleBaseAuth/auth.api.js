const express = require("express");
const router = express.Router();
const userController = require("../../../controller/user.controller");
const roleController = require("../../../controller/role.controller");
const permissionController = require("../../../controller/permission.controller");
const {
  checkPermission,
} = require("../../../middleware/checkPermission.middleware");

// User routes
router.post(
  "/users",
  checkPermission("create_user"),
  userController.createUser
);
router.get("/users", checkPermission("view_user"), userController.getAllUsers);
router.get(
  "/users/:id",
  checkPermission("view_user"),
  userController.getUserById
);
router.put(
  "/users/:id",
  checkPermission("edit_user"),
  userController.updateUser
);
router.delete(
  "/users/:id",
  checkPermission("delete_user"),
  userController.deleteUser
);

// Role routes
router.post(
  "/roles",
  checkPermission("create_role"),
  roleController.createRole
);
router.get("/roles", checkPermission("view_role"), roleController.getAllRoles);
router.get(
  "/roles/:id",
  checkPermission("view_role"),
  roleController.getRoleById
);
router.put(
  "/roles/:id",
  checkPermission("edit_role"),
  roleController.updateRole
);
router.delete(
  "/roles/:id",
  checkPermission("delete_role"),
  roleController.deleteRole
);

// Permission routes
router.post(
  "/permissions",
  checkPermission("create_permission"),
  permissionController.createPermission
);
router.get(
  "/permissions",
  checkPermission("view_permission"),
  permissionController.getAllPermissions
);

module.exports = router;
