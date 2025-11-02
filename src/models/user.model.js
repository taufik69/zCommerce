const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String },
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
    twoFactorEnabled: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// compare password
userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
  next();
});

// compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate JWT token
// Generate JWT token
userSchema.methods.generateJwtRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SCCERET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

// generate JWT access token
userSchema.methods.generateJwtAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      name: this.name,
      phone: this.phone,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPRIY,
    }
  );
};

// veryfy JWT token
userSchema.methods.verifyJwtRefreshToken = function (token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SCCRECT);
};

module.exports = mongoose.model("User", userSchema);
