import { CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS, REDIS_URL } from "../config/index.js";
import { redisClient } from "../infra/redis/redisClient.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

// Map iteration order is insertion order, so re-inserting on read gives LRU eviction. The bound
// matters because keys include request parameters: without it, varied queries grew memory forever.
const memoryCache = new Map<string, CacheEntry>();

export const cache = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    memoryCache.delete(key);
    if (entry.expiresAt <= Date.now()) return null;
    memoryCache.set(key, entry);
    return entry.value as T;
  },

  async set(key: string, value: unknown, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
    memoryCache.delete(key);
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (memoryCache.size > CACHE_MAX_ENTRIES) {
      const oldest = memoryCache.keys().next().value;
      if (oldest === undefined) break;
      memoryCache.delete(oldest);
    }
  },

  async del(prefix: string): Promise<void> {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
  },

  size: () => memoryCache.size,

  backend: REDIS_URL ? "redis-ready" : "memory",
  client: redisClient.mode,
};
