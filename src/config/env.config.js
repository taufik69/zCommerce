require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  DATABASE_URL: process.env.DATABASE_URL,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SCCERET,
  INVOICE_PREFIX: process.env.INVOICE_PREFIX || "INV",
};

module.exports = { env };
