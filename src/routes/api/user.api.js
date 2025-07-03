const express = require("express");
const _ = express.Router();
const authController = require("../../controller/user.controller");
const { authGuard } = require("../../middleware/authMiddleware");
_.post("/registeruser", authController.registerUser);
_.post("/login", authController.login);
_.post("/refresh-token", authController.refreshToken);
_.post("/logout", authGuard, authController.logout);
// user control
_.post("/send-email-verification", authController.sendEmailVerification);
_.post("/verify-email", authController.verifyEmail);
_.post("/forgot-password", authController.forgotPassword);
_.post("/reset-password", authController.resetPassword);
_.get("/getallusers", authGuard, authController.getAllUser);
_.get("/change-password", authGuard, authController.changePassword);
_.get(
  "/getuserbyemailorphone",
  authGuard,
  authController.getUserbyEmailOrPhone
);
module.exports = _;
