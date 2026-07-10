const { initSocket } = require("./socket/socket");
const express = require("express");
const { globalErrorHandeler } = require("./lib/GlobalErrorHandeler");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieparser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const http = require("http");

const app = express();
const server = http.createServer(app);

// ====== Security Middlewares ======
app.set("trust proxy", 1);
app.set("etag", false);
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.DASHBOARD_URL,
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5172",
        "http://localhost:5174",
        "http://165.99.165.19",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
  }),
);

app.use(cookieparser());

// 4. Morgan -> Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// 5. Rate Limiter -> Prevent brute-force / abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000000000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// routes
app.use(process.env.BASE_URL || "/api/v1", require("../src/routes/index"));

// initialize socket
const io = initSocket(server);

// global error handler
app.use(globalErrorHandeler);

// export both app & server for usage
module.exports = { server, io };
