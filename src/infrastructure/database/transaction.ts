import mongoose, { type ClientSession } from "mongoose";

let transactionsSupported: boolean | undefined;

/** Transactions need a replica set or sharded cluster; standalone servers reject them. */
export const supportsTransactions = async (): Promise<boolean> => {
  if (transactionsSupported !== undefined) return transactionsSupported;
  const db = mongoose.connection.db;
  if (!db) return false;
  const hello = await db.admin().command({ hello: 1 });
  transactionsSupported = Boolean(hello.setName) || hello.msg === "isdbgrid";
  return transactionsSupported;
};

/** Test hook: forget the cached topology check (e.g. after reconnecting to another server). */
export const resetTransactionSupportCache = () => {
  transactionsSupported = undefined;
};

export interface TransactionOutcome<T> {
  result: T;
  transactional: boolean;
}

/**
 * Runs `work` inside a transaction when the deployment supports it (retrying transient errors
 * via withTransaction), otherwise runs it once with `session = null`. Callers that write
 * several documents must make the `null` path safe on their own (atomic updates/compensation).
 */
export const runInTransaction = async <T>(work: (session: ClientSession | null) => Promise<T>): Promise<TransactionOutcome<T>> => {
  if (!(await supportsTransactions())) {
    return { result: await work(null), transactional: false };
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return { result: result as T, transactional: true };
  } finally {
    await session.endSession();
  }
};

export const sessionOption = (session: ClientSession | null) => (session ? { session } : {});
