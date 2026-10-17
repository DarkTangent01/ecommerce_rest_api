import { REDIS_URL } from "../../config/index.js";

const memory = new Map<string, unknown>();

export const redisClient = {
  mode: REDIS_URL ? "redis-configured" : "memory-fallback",

  async get(key: string): Promise<unknown> {
    return memory.get(key) || null;
  },

  async set(key: string, value: unknown, options: { EX?: number } = {}): Promise<void> {
    memory.set(key, value);
    if (options.EX) {
      setTimeout(() => memory.delete(key), options.EX * 1000).unref?.();
    }
  },

  async del(key: string): Promise<void> {
    memory.delete(key);
  },

  async incr(key: string): Promise<number> {
    const next = Number(memory.get(key) || 0) + 1;
    memory.set(key, next);
    return next;
  },
};
