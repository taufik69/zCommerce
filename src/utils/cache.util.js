const { cache } = require("@/config/redis.config");

const safeJsonParse = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const getCache = async (key) => {
  const data = await cache.get(key);
  return data ? safeJsonParse(data) : null;
};

const setCache = async (key, value, ttl = 60) => {
  await cache.set(key, JSON.stringify(value), "EX", ttl);
};

const deleteCache = async (key) => {
  await cache.del(key);
};

// ---- namespace versioning helpers ----

const getNsVersion = async (ns) => {
  const v = await cache.get(`${ns}:v`);
  return v ? Number(v) : 1;
};

const bumpNsVersion = async (ns) => {
  // atomic increment — all old versioned keys become unreachable
  const v = await cache.incr(`${ns}:v`);
  return v;
};

const buildCacheKey = async (ns, suffix) => {
  const v = await getNsVersion(ns);
  return `${ns}:v${v}:${suffix}`;
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  getNsVersion,
  bumpNsVersion,
  buildCacheKey,
};
