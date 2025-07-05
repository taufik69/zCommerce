const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
require("../models/permisson.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

exports.authGuard = asynchandeler(async (req, res, next) => {

  let token =
    req.headers?.authorization?.trim() ||
    req.cookies?.accessToken?.trim() ||
    req.cookies?.token?.trim();



  if (!token || token === "null" || token === "undefined") {
    throw new customError("Token not found or Invalid / Token Required", 401);
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SCCRECT);

  if (!decoded) {
    throw new customError("Invalid token", 401);
  }
const user = await User.findOne({
  $or: [{ email: decoded.email }, { phone: decoded.phone }],
}).select(
  "-__v -wishList -cart -newsLetterSubscribe -lastLogout -createdAt -twoFactorEnabled -isEmailVerified -isPhoneVerified -roles -permission"
);


  if (!user) {
    return apiResponse.sendSuccess(res, 401, "User not found");
  }
  req.user = user;
  next();
});
