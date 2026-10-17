import { CACHE_TTL_SECONDS, REDIS_URL } from "../config/index.js";
import { redisClient } from "../infra/redis/redisClient.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

export const cache = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set(key: string, value: unknown, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(prefix: string): Promise<void> {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
  },

  backend: REDIS_URL ? "redis-ready" : "memory",
  client: redisClient.mode,
};
