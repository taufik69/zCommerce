const express = require("express");
const { globalErrorHandeler } = require("./lib/GlobalErrorHandeler");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const app = express();

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
      "https://z-ecommerce-seven.vercel.app"
    ],
    credentials: true,
  })
);
app.use(cookieparser());

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
