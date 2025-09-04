const express = require("express");
const { globalErrorHandeler } = require("./lib/GlobalErrorHandeler");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieparser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const app = express();

// ====== Security Middlewares ======

app.use(helmet());
/**
 * todo : All middleware
 * *motive: Middleware are used to configuration
 */
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5172",
      "http://localhost:5174",
      "https://smartsoftnextjs-ecommerce-git-main-wasim-mahamods-projects.vercel.app",
      "https://smartsoftnextjs-ecommerce.vercel.app",
      "https://z-ecommerce-seven.vercel.app",
    ],
    credentials: true,
  })
);

/**
 * rate limiter
 * this middleware are used to limit request
 */
app.use(cookieparser());

// 4. Morgan -> Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}
// 5. Rate Limiter -> Prevent brute-force / abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Max 100 requests per 15 minutes per IP
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

/**
 * Todo : This middleware express.json are used to parse from data
 */
app.use(express.json());
/**
 * Todo : This middleware are parse search string and like extract data from url
 */
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// routes
app.use(process.env.BASE_URL || "/api/v1", require("../src/routes/index"));

// this is global Error handaler method // this middleware always niche thakbe
app.use(globalErrorHandeler);

module.exports = { app };
