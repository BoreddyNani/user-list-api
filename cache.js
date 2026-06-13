const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');          // defaults to localhost:6379

const getCache = async (key) => {
  const val = await redis.get(key);
  return val ? JSON.parse(val) : null;
};

const setCache = async (key, value, ttl = 60) => {
  await redis.setex(key, ttl, JSON.stringify(value));
};

const deleteCache = async (key) => redis.del(key);

module.exports = { getCache, setCache, deleteCache };
