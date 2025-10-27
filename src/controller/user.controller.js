const User = require("../models/user.model");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { validateUser } = require("../validation/user.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");

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

  // Create user
  const user = new User({
    name,
    email,
    password,
    phone,
    image: image || null,
    roles: [],
    permissions: [],
  });

  await user.save();

  // again find user
  const userObj = await User.findById(user._id)
    .populate({
      path: "roles",
      select: "-__v -createdAt -updatedAt",
    })
    .populate("permissions")
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -updatedAt -wishList -cart -newsLetterSubscribe -lastlogin -lastLogout -createdAt -refreshToken -twoFactorEnabled -newsLetterSubscribe -isEmailVerified -isPhoneVerified"
    );
  userObj.isEmailVerified = false;
  userObj.isPhoneVerified = false;
  await userObj.save();
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

  // set refresh token in cookie
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

  apiResponse.sendSuccess(res, 200, "Logout successful");
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

  apiResponse.sendSuccess(res, 200, "Verification email sent");
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

  apiResponse.sendSuccess(res, 200, "Email verified successfully");
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

  apiResponse.sendSuccess(res, 200, "Password reset email sent");
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

  apiResponse.sendSuccess(res, 200, "Password reset successful");
});

//change paassword
exports.changePassword = asynchandeler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new customError("User not found", 404);

  const { oldPassword, newPassword } = req.body;

  //check password have number and text and minimunm 8 character using regex
  if (!/^(?=.*\d)(?=.*[a-zA-Z]).{8,}$/.test(newPassword)) {
    throw new customError(
      "Password must contain at least 8 characters, including at least one letter and one number",
      400
    );
  }

  if (!(await user.comparePassword(oldPassword))) {
    throw new customError("Old password is incorrect", 400);
  }

  user.password = newPassword;
  await user.save();

  return apiResponse.sendSuccess(res, 200, "Password changed successfully");
});

// get all user
exports.getAllUser = asynchandeler(async (_, res) => {
  const users = await User.find()
    .select(
      "-__v -password -refreshToken  -createdAt  -twoFactorEnabled -newsLetterSubscribe "
    )
    .populate([{ path: "roles" }])
    .populate("wishList")
    .populate("permissions")
    .lean()
    .sort({ createdAt: -1 });
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
  apiResponse.sendSuccess(res, 200, "User fetched successfully", user);
});

//get me routes
exports.getMe = asynchandeler(async (req, res) => {
  const user = req.user;

  apiResponse.sendSuccess(res, 200, "User fetched successfully", user);
});

// search a user andd add permissin in  permission array
exports.addPermissionToUser = asynchandeler(async (req, res) => {
  const { userId, permissionId } = req.body;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", 404);

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission) throw new customError("Permission not found", 404);

  // Add permission to user's permissions array
  user.permissions.push(permission._id);
  await user.save();

  apiResponse.sendSuccess(res, 200, "Permission added successfully", {
    user,
    permission,
  });
});
// remove permission from user
exports.removePermissionFromUser = asynchandeler(async (req, res) => {
  const { userId, permissionId } = req.body;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", 404);

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission) throw new customError("Permission not found", 404);

  // Remove permission from user's permissions array
  user.permissions = user.permissions.filter(
    (perm) => perm.toString() !== permission._id.toString()
  );
  await user.save();

  apiResponse.sendSuccess(res, 200, "Permission removed successfully", {
    user,
    permission,
  });
});

// is SuperAdmin
exports.isSuperAdmin = asynchandeler(async (req, res) => {
  const { email, password, phone } = req.body;
  if (!email && !phone) {
    throw new customError("Email or phone is required", 400);
  }
  const user = await User.findOne({ $or: [{ email }, { phone }] });
  if (!user) {
    throw new customError("User not found", 404);
  }

  const isSuperAdmin = user?.roles?.some((role) => role.slug === "superadmin");
  return apiResponse.sendSuccess(res, 200, "User fetched successfully", {
    isSuperAdmin,
  });
});

// add user
exports.addUser = asynchandeler(async (req, res) => {
  const value = await validateUser(req);

  // Create user first
  const user = await User.create({
    ...value,
    image: null,
    roles: value.role ? [value.role] : [],
    createdBy: req.user?._id || null,
  });

  // Start upload in background (non-blocking)
  (async () => {
    try {
      const { optimizeUrl } = await cloudinaryFileUpload(value.image.path);
      await User.findByIdAndUpdate(user._id, { image: optimizeUrl });
    } catch (err) {
      console.error("Background image upload failed:", err.message);
    }
  })();

  apiResponse.sendSuccess(
    res,
    201,
    "User created successfully (image uploading in background)",
    {
      _id: user._id,
      name: user.name,
      email: user.email,
    }
  );
});

// get user added by admin
exports.getUserAddedByAdmin = asynchandeler(async (req, res) => {
  const users = await User.find({})
    .select(
      "-__v -password -refreshToken -createdAt -twoFactorEnabled -newsLetterSubscribe"
    )
    .populate("roles");

  // filter users added by admin and roles array have some value

  const filteredUsers = users.filter(
    (user) => user.roles && user.roles.length > 0
  );
  console.log("req.user._id:", filteredUsers);
  apiResponse.sendSuccess(
    res,
    200,
    "Users fetched successfully",
    filteredUsers
  );
});

// user update
exports.updateUser = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // ✅ Manual basic field validation
  const requiredFields = ["name", "email", "phone"];
  for (const field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === "") {
      throw new customError(`${field} is required`, 400);
    }
  }

  // ✅ Prepare update object
  const updateData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
  };

  // ✅ Add password only if given
  if (data.password && data.password.trim() !== "") {
    updateData.password = data.password;
  }

  // ✅ Replace roles array if new role given
  if (data.role) {
    updateData.roles = [data.role];
  }

  // ✅ Handle image upload & old image deletion
  if (req.file) {
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!validTypes.includes(req.file.mimetype)) {
      throw new customError(
        "Invalid image format. Only JPG, PNG, and WEBP are allowed.",
        400
      );
    }
    if (req.file.size > 2 * 1024 * 1024) {
      throw new customError("Image size should be less than 2MB.", 400);
    }

    // Find existing user to get old image
    const existingUser = await User.findById(id);
    if (!existingUser) {
      throw new customError("User not found", 404);
    }

    // Delete old image from Cloudinary if it exists
    if (existingUser.image) {
      const match = existingUser.image.split("/");
      const publicId = match[match.length - 1].split(".")[0];
      if (publicId) {
        await deleteCloudinaryFile(publicId.split("?")[0]);
      }
    }

    // Upload new image
    const upload = await cloudinaryFileUpload(req.file.path);
    updateData.image = upload.optimizeUrl;
  }

  // ✅ Update user in DB
  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("roles")
    .populate("permissions")
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -updatedAt -wishList -cart -newsLetterSubscribe -lastlogin -lastLogout -createdAt -refreshToken -twoFactorEnabled -isEmailVerified -isPhoneVerified"
    );

  if (!updatedUser) {
    throw new customError("User not found", 404);
  }

  apiResponse.sendSuccess(res, 200, "User updated successfully", updatedUser);
});

// delte user
exports.deleteUser = asynchandeler(async (req, res) => {
  const { id } = req.params;

  // Find user first
  const user = await User.findById(id);
  if (!user) {
    throw new customError("User not found", 404);
  }

  // Delete image from Cloudinary if exists
  if (user.image) {
    const match = user.image.split("/");
    const publicId = match[match.length - 1].split(".")[0];
    if (publicId) {
      await deleteCloudinaryFile(publicId.split("?")[0]);
    }
  }

  // Delete user from DB
  await User.findByIdAndDelete(id);

  apiResponse.sendSuccess(res, 200, "User deleted successfully", user);
});
