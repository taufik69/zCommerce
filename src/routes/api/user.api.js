const express = require("express");
const _ = express.Router();
const authController = require("../../controller/user.controller");
_.post("/registeruser", authController.registerUser);
_.post("/login", authController.login);
_.post("/refresh-token", authController.refreshToken);
_.post("/logout", authController.logout);
// user control
_.post("/send-email-verification", authController.sendEmailVerification);
_.post("/verify-email", authController.verifyEmail);
_.post("/forgot-password", authController.forgotPassword);
_.post("/reset-password", authController.resetPassword);
_.get("/getallusers", authController.getAllUser);
_.get("/getuserbyemailorphone", authController.getUserbyEmailOrPhone);
module.exports = _;
