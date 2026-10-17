import { AppError } from "../../shared/errors/AppError.js";

const locks = new Map<string, number>();

export class LockedError extends AppError {
  constructor(message = "Resource is locked") {
    super(423, message);
  }
}

export const withDistributedLock = async <T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> => {
  const existing = locks.get(key);
  if (existing && existing > Date.now()) {
    throw new LockedError();
  }

  locks.set(key, Date.now() + ttlMs);
  try {
    return await fn();
  } finally {
    locks.delete(key);
  }
};
