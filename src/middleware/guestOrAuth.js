const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

exports.guestOrAuth = asynchandeler(async (req, res, next) => {
  let token = req.headers?.authorization?.replace("Bearer ", "") || req.body?.token;
  let guestId = req.headers["x-guest-id"] || req.body?.guestId;

  if (token && token !== "null" && token !== "undefined") {
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if (!decoded) {
        throw new customError("Invalid token", 401);
      }
      const user = await User.findOne({
        $or: [{ email: decoded.email }, { phone: decoded.phone }],
      }).select("_id"); // We only need the user ID for cart logic
      
      if (!user) {
        throw new customError("User not found", 401);
      }
      
      req.user = user;
      return next();
    } catch (error) {
      throw new customError("Invalid or expired token", 401);
    }
  }

  // If no valid token, check for guestId
  if (guestId) {
    req.guestId = guestId;
    return next();
  }

  // If neither exists
  throw new customError("Authentication required or x-guest-id header missing", 401);
});
