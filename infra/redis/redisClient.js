import { REDIS_URL } from "../../config/index.js";

const memory = new Map();

export const redisClient = {
  mode: REDIS_URL ? "redis-configured" : "memory-fallback",

  async get(key) {
    return memory.get(key) || null;
  },

  async set(key, value, options = {}) {
    memory.set(key, value);
    if (options.EX) {
      setTimeout(() => memory.delete(key), options.EX * 1000).unref?.();
    }
  },

  async del(key) {
    memory.delete(key);
  },

  async incr(key) {
    const next = Number(memory.get(key) || 0) + 1;
    memory.set(key, next);
    return next;
  },
};
