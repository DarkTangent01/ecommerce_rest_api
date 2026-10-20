import crypto from "crypto";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Process-local mutual exclusion with expiry and owner-checked release (I-1).
 *
 * Despite the historical name this is NOT distributed: with several API instances each has its
 * own lock table, so the per-user checkout lock no longer serialises requests across instances.
 * Stock and coupon usage stay correct regardless, because they use atomic conditional updates;
 * the lock only reduces duplicate work. Before scaling out, back this with Redis
 * (SET key token NX PX ttl, and release with a compare-token-then-delete script).
 */
const locks = new Map<string, { token: string; expiresAt: number }>();

export class LockedError extends AppError {
  constructor(message = "Resource is locked") {
    super(423, message);
  }
}

export const acquireLock = (key: string, ttlMs: number): string | null => {
  const existing = locks.get(key);
  if (existing && existing.expiresAt > Date.now()) return null;
  const token = crypto.randomUUID();
  locks.set(key, { token, expiresAt: Date.now() + ttlMs });
  return token;
};

/** Releases only if `token` still owns the lock: a holder that outlived its TTL cannot free the next owner's lock. */
export const releaseLock = (key: string, token: string): boolean => {
  if (locks.get(key)?.token !== token) return false;
  locks.delete(key);
  return true;
};

export const withDistributedLock = async <T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> => {
  const token = acquireLock(key, ttlMs);
  if (!token) throw new LockedError();
  try {
    return await fn();
  } finally {
    releaseLock(key, token);
  }
};
