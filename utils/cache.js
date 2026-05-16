import { CACHE_TTL_SECONDS, REDIS_URL } from "../config/index.js";
import { redisClient } from "../infra/redis/redisClient.js";

const memoryCache = new Map();

export const cache = {
  async get(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(prefix) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
  },

  backend: REDIS_URL ? "redis-ready" : "memory",
  client: redisClient.mode,
};
