const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    isActive: { type: Boolean, default: true },
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
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate JWT token
userSchema.methods.generateJwtRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SCCERET, {
    expiresIn: REFRESH_TOKEN_EXPIRY || "15d",
  });
};

// generate JWT aceess token
userSchema.methods.generateJwtAccessToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, name: this.name, role: this.roles },
    process.env.ACCESS_TOKEN_SCCRECT,
    {
      expiresIn: ACCESS_TOKEN_EXPRIY || "1h",
    }
  );
};

module.exports = mongoose.model("User", userSchema);
