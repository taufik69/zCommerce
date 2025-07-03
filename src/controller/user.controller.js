const User = require("../models/user.model");
const Role = require("../models/role.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { validateUser } = require("../validation/user.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const { log } = require("console");

// user registraion/ or add user
exports.registerUser = asynchandeler(async (req, res) => {
  // Validate input
  const value = await validateUser(req);
  const { name, email, password, phone, image } = value;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    throw new customError("Email or phone already in use", 409);
  }

  // Find default role (e.g., "user")
  const defaultRole = await Role.findOne({ name: "user" });
  if (!defaultRole) {
    throw new customError("Default user role not found", 500);
  }

  // Create user fill up all field
  const user = new User({
    name,
    email,
    password,
    phone,
    image: image || null,
    roles: [defaultRole._id],
  });

  await user.save();

  // again find user
  const userObj = await User.findById(user._id)
    .populate({
      path: "roles",
      select: "-__v -createdAt -updatedAt",
    })
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -updatedAt -wishList -cart -newsLetterSubscribe -lastlogin -lastLogout -createdAt -refreshToken -twoFactorEnabled -newsLetterSubscribe -isEmailVerified -isPhoneVerified"
    );

  return apiResponse.sendSuccess(res, 201, "Registration successful", userObj);
});

// user login and send a refresh token and access token
exports.login = asynchandeler(async (req, res) => {
  const { email, password, phone } = req.body;


  const user = await User.findOne({ $or: [{ email }, { phone }] }).select(
    "-__v -wishList -cart -newsLetterSubscribe  -lastLogout -createdAt  -twoFactorEnabled -newsLetterSubscribe -isEmailVerified -isPhoneVerified -roles -permission"
  );
  if (!user) {
    throw new customError("User not found", 404);
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new customError("Invalid credentials", 401);
  }

  // generate access token and refresh token
  const accessToken = await user.generateJwtAccessToken();
  const refreshToken = await user.generateJwtRefreshToken();

  // save refresh Token into Database
  user.refreshToken = refreshToken;
  user.lastlogin = Date.now();
  await user.save();

  // now remove password from response
  const {
    password: userPassword,
    refreshToken: userRefreshToken,
    ...userData
  } = user.toObject();
  delete userData.userPassword;
  delete userData.userRefreshToken;

  // now send  refresh token via cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: process.env.NODE_ENV === "production" ? true : false, // secure: true,
    secure: process.env.NODE_ENV === "production" ? true : false, // set to true in production
    sameSite: "none",
  });

  return apiResponse.sendSuccess(res, 200, "Login successful", {
    accessToken,
    user: userData,
  });
});

// make a refresh token using cookie data or headers data
exports.refreshToken = asynchandeler(async (req, res) => {
  const refreshToken =
    req.cookies.refreshToken.trim() || req.headers["x-refresh-token"].trim();
  if (!refreshToken) {
    throw new customError("Refresh token not found", 401);
  }

  // check refresh token in database
  const user = await User.findOne({ refreshToken });
  if (!user) {
    throw new customError("Invalid refresh token", 401);
  }
  // vefiy token using
  const decoded = jwt.verify(
    user.refreshToken,
    process.env.REFRESH_TOKEN_SCCERET
  );
  if (!decoded) {
    throw new customError("Invalid refresh token", 401);
  }

  // generate access token and refresh token
  const accessToken = await user.generateJwtAccessToken();

  return apiResponse.sendSuccess(res, 200, "Refresh token send successful", {
    accessToken,
  });
});

//logout user
exports.logout = asynchandeler(async (req, res) => {
  const refreshToken =
    req.cookies.refreshToken.trim() || req.headers["x-refresh-token"].trim();
  if (!refreshToken) {
    throw new customError("Refresh token not found", 401);
  }

  // check refresh token in database
  const user = await User.findOne({ refreshToken });
  if (!user) {
    throw new customError("Invalid refresh token", 401);
  }
  // vefiy token using
  const decoded = jwt.verify(
    user.refreshToken,
    process.env.REFRESH_TOKEN_SCCERET
  );
  if (!decoded) {
    throw new customError("Invalid refresh token", 401);
  }

  // delete refresh token from database
  user.refreshToken = null;
  await user.save();

  // remove refresh token from cookie
  res.clearCookie("refreshToken", {
    httpOnly: process.env.NODE_ENV === "production" ? true : false, // secure: true,
    secure: process.env.NODE_ENV === "production" ? true : false, // set to true in production
    sameSite: "none",
  });

  return apiResponse.sendSuccess(res, 200, "Logout successful");
});

// send email verification
exports.sendEmailVerification = asynchandeler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new customError("User not found", 404);

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  // Send email (replace with your mail config)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    // secure: true,
    auth: {
      user: process.env.HOST_MAIL,
      pass: process.env.HOST_APP_PASSWORD,
    },
  });
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}&email=${user.email}`;
  await transporter.sendMail({
    to: user.email,
    subject: "Verify your email",
    html: `<a href="${verifyUrl}">Click to verify your email</a>`,
  });

  return apiResponse.sendSuccess(res, 200, "Verification email sent");
});

// verify email
exports.verifyEmail = asynchandeler(async (req, res) => {
  const { token, email } = req.query;
  const user = await User.findOne({
    email,
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) throw new customError("Invalid or expired token", 400);

  user.isEmailVerified = true;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return apiResponse.sendSuccess(res, 200, "Email verified successfully");
});

//forgot password
exports.forgotPassword = asynchandeler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new customError("User not found", 404);

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  // Send reset email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    // secure: true,
    auth: {
      user: process.env.HOST_MAIL,
      pass: process.env.HOST_APP_PASSWORD,
    },
  });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${user.email}`;
  await transporter.sendMail({
    to: user.email,
    subject: "Reset your password",
    html: `<a href="${resetUrl}">Click to reset your password</a>`,
  });

  return apiResponse.sendSuccess(res, 200, "Password reset email sent");
});

// reset password
exports.resetPassword = asynchandeler(async (req, res) => {
  const { token, email, newPassword } = req.body;
  const user = await User.findOne({
    email,
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) throw new customError("Invalid or expired token", 400);

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return apiResponse.sendSuccess(res, 200, "Password reset successful");
});

//change paassword
// exports.changePassword = asynchandeler(async (req, res) => {
//   const user = await User.findById(req.user.id);
//   const { oldPassword, newPassword } = req.body;

//   if (!(await user.comparePassword(oldPassword))) {
//     throw new customError("Old password is incorrect", 400);
//   }

//   user.password = newPassword;
//   await user.save();

//   return apiResponse.sendSuccess(res, 200, "Password changed successfully");
// });

// get all user
exports.getAllUser = asynchandeler(async (_, res) => {
  const users = await User.find()
    .select(
      "-__v -password -refreshToken  -createdAt  -twoFactorEnabled -newsLetterSubscribe "
    )
    .populate([
      { path: "roles" },
      // { path: "permission" },
      { path: "wishList" },
      { path: "cart" },
    ])
    .lean();
  return apiResponse.sendSuccess(res, 200, "User fetched successfully", users);
});

// get single user using email or phone
exports.getUserbyEmailOrPhone = asynchandeler(async (req, res) => {
  const { email, phone } = req.query;
  const user = await User.findOne({ $or: [{ email }, { phone }] })
    .select(
      "-__v -password -refreshToken  -createdAt  -twoFactorEnabled -newsLetterSubscribe "
    )
    .populate([
      { path: "roles" },
      // { path: "permission" },
      { path: "wishList" },
      { path: "cart" },
    ]);
  if (!user) throw new customError("User not found", 404);
  return apiResponse.sendSuccess(res, 200, "User fetched successfully", user);
});
