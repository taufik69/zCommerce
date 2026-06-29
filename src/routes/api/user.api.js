const express = require("express");
const _ = express.Router();
const authController = require("../../controller/user.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const {
  multipleFileUpload,
  singleFileUpload,
} = require("../../middleware/multer.middleware");

_.post("/registeruser", authController.registerUser);
_.post("/login", authController.login);
_.post("/refresh-token", authController.refreshToken);
_.post("/logout", authController.logout);
// user control
_.post("/send-email-verification", authController.sendEmailVerification);
_.post("/verify-email", authController.verifyEmail);
_.post("/forgot-password", authController.forgotPassword);
_.post("/reset-password", authController.resetPassword);
_.get("/getallusers", authGuard, authorize("create-user", "view"), authController.getAllUser);
_.get("/change-password", authGuard, authController.changePassword);
_.get(
  "/getuserbyemailorphone",
  authGuard,
  authorize("create-user", "view"),
  authController.getUserbyEmailOrPhone,
);
_.get("/getme", authGuard, authController.getMe);
_.put("/add-user-permission", authGuard, authController.addPermissionToUser);
_.put(
  "/remove-user-permission/:id",
  authGuard,
  authorize("create-user", "edit"),
  authController.removePermissionFromUser,
);

_.get("/isSuperAdmin", authGuard, authController.isSuperAdmin);
_.post(
  "/add-user",
  authGuard,
  authorize("create-user", "add"),
  singleFileUpload("image"),
  authController.addUser,
);
_.get(
  "/get-user-added-by-admin",
  authGuard,
  authorize("create-user", "view"),
  authController.getUserAddedByAdmin,
);
_.delete(
  "/detete-user/:id",
  authGuard,
  authorize("create-user", "delete"),
  authController.deleteUser,
);
_.put(
  "/user-update/:id",
  authGuard,
  authorize("create-user", "edit"),
  singleFileUpload("image"),
  authController.updateUser,
);

module.exports = _;
