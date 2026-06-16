const IORedis = require("ioredis");
const { env } = require("./env.config");

// BullMQ requires maxRetriesPerRequest: null
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// General-purpose cache client for Redis commands
const cache = new IORedis(env.REDIS_URL, {
  tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

connection.on("error", (err) =>
  console.error("[Redis/connection] Error:", err.message),
);
connection.on("connect", () => console.log("[Redis/connection] Connected ✅"));

cache.on("error", (err) => console.error("[Redis/cache] Error:", err.message));
cache.on("connect", () => console.log("[Redis/cache] Connected ✅"));

module.exports = { connection, cache };
