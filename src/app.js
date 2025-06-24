const express = require("express");
const { globalErrorHandeler } = require("./lib/GlobalErrorHandeler");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const app = express();

/**
 * todo : All middleware
 * *motive: Middleware are used to configuration
 */
app.use(cors());
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
