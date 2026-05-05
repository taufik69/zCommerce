require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { default: slugify } = require("slugify");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processing", "uploaded", "failed"],
      default: "pending",
    },
    localPath: { type: String, default: "" },
    tries: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: {
      type: imageSchema,
      default: () => ({}),
    },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    permissions: [
      {
        permission: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Permission",
        },
        actions: [{ type: String }],
      },
    ],
    Options: [{ type: String }],
    Reports: [{ type: String }],
    phone: { type: String, unique: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    lastlogin: { type: Date },
    lastLogout: { type: Date },
    wishList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    newsLetterSubscribe: { type: Boolean, default: false },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    discountLimit: {
      type: Number,
      default: 0,
      max:[100 , "Discount limit cannot be greater than 100"]
    },
    twoFactorEnabled: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true },
);

// Performance Indexes
userSchema.index({ name: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1, isBlocked: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// compare password
userSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate() || {};

    // handle both direct and $set updates
    const $set = update.$set || update;

    if ($set.password) {
      $set.password = await bcrypt.hash($set.password, 10);
    }

    // re-assign update safely
    if (update.$set) update.$set = $set;
    else Object.assign(update, $set);

    this.setUpdate(update);

    return next();
  } catch (error) {
    return next(error);
  }
});

// compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  // password field fetch না করলে বা missing হলে সরাসরি false
  if (!this.password) return false;

  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    return false;
  }
};

// Generate JWT token
// Generate JWT token
userSchema.methods.generateJwtRefreshToken = function () {
  try {
    if (!process.env.REFRESH_TOKEN_SCCERET) {
      throw new customError(
        "Refresh token secret is not defined",
        statusCodes.SERVER_ERROR,
      );
    }

    return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SCCERET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    });
  } catch (error) {
    throw new customError(
      "Failed to generate refresh token",
      statusCodes.SERVER_ERROR,
    );
  }
};

// generate JWT access token
userSchema.methods.generateJwtAccessToken = function () {
  try {
    if (!process.env.ACCESS_TOKEN_SECRET) {
      throw new customError(
        "Access token secret is not defined",
        statusCodes.SERVER_ERROR,
      );
    }

    return jwt.sign(
      {
        id: this._id,
        email: this.email,
        name: this.name,
        phone: this.phone,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
      },
    );
  } catch (error) {
    throw new customError(
      "Failed to generate access token",
      statusCodes.SERVER_ERROR,
    );
  }
};

// veryfy JWT token
userSchema.methods.verifyJwtRefreshToken = function (token) {
  try {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SCCERET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new customError("Refresh token expired", statusCodes.UNAUTHORIZED);
    }
    throw new customError("Invalid refresh token", statusCodes.UNAUTHORIZED);
  }
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
