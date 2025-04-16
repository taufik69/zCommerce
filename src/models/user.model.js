const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "user"],
      default: "user",
    },
    avatar: {
      type: String,
      trim: true,
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

/*
 *when user register then password will encrypt
 * when user change password then password will encrypt
 */
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  }
  this.email = this.email.toLowerCase();
  next();
});

/**
 * compare the user passowrd
 *
 */
userSchema.methods.iscorrectPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);

// export default mongoose.model("User", userSchema);
