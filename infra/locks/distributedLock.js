const locks = new Map();

export const withDistributedLock = async (key, ttlMs, fn) => {
  const existing = locks.get(key);
  if (existing && existing > Date.now()) {
    const err = new Error("Resource is locked");
    err.status = 423;
    throw err;
  }

  locks.set(key, Date.now() + ttlMs);
  try {
    return await fn();
  } finally {
    locks.delete(key);
  }
};
