const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");

exports.protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new customError("No token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).populate("roles");
    next();
  } catch (error) {
    throw new customError("Not authorized / Invalid token", 401);
  }
};
