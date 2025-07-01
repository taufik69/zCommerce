const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

exports.authGuard = asynchandeler(async (req, res, next) => {
  let token =
    req.headers.authorization.trim() ||
    req.cookies?.accessToken.trim() ||
    req.cookies?.token.trim();

  if (!token) {
    throw new customError("Token not found or Invalid", 401);
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SCCRECT);
  if (!decoded) {
    throw new customError("Invalid token", 401);
  }
  const user = await User.findById(decoded.id)
    .populate("roles")
    .populate("permission");
  console.log(user);

  if (!user) {
    return apiResponse.sendSuccess(res, 401, "User not found");
  }
  req.user = user;
  // next();
});
