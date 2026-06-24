const Redis = require("ioredis");
let redis;

const getRedisClient = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
};

const getCache = async (key) => {
  const client = getRedisClient();
  const val = await client.get(key);
  return val ? JSON.parse(val) : null;
};

const setCache = async (key, value, ttl = 60) => {
  const client = getRedisClient();
  await client.setex(key, ttl, JSON.stringify(value));
};

const deleteCache = async (key) => {
  const client = getRedisClient();
  return client.del(key);
};

module.exports = { getCache, setCache, deleteCache };
