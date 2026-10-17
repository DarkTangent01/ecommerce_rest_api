const ALLOWED_SORT_DIRECTIONS = new Set(["asc", "desc", "1", "-1"]);

/** Raw query values as Express parses them; anything non-string is ignored. */
export type QueryInput = Record<string, unknown>;

export interface PaginationDefaults {
  limit?: number;
  maxLimit?: number;
}

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export const buildPagination = (query: QueryInput, defaults: PaginationDefaults = {}) => {
  const maxLimit = defaults.maxLimit || 100;
  const page = Math.max(Number.parseInt(asString(query.page) ?? "", 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(asString(query.limit) ?? "", 10) || defaults.limit || 20, 1), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildSort = (sortBy: unknown, order: unknown, allowedFields: readonly string[], fallback = "-createdAt"): string => {
  if (typeof sortBy !== "string" || !allowedFields.includes(sortBy)) {
    return fallback;
  }

  const safeOrder = ALLOWED_SORT_DIRECTIONS.has(String(order).toLowerCase()) ? String(order) : "asc";
  const prefix = safeOrder.toLowerCase() === "desc" || safeOrder === "-1" ? "-" : "";
  return `${prefix}${sortBy}`;
};

export const buildCursorPagination = (query: QueryInput, defaults: PaginationDefaults = {}) => {
  const limit = Math.min(Math.max(Number.parseInt(asString(query.limit) ?? "", 10) || defaults.limit || 20, 1), defaults.maxLimit || 100);
  const rawCursor = asString(query.cursor);
  const cursor = rawCursor ? new Date(rawCursor) : null;
  const cursorFilter: { createdAt?: { $lt: Date } } = cursor && !Number.isNaN(cursor.getTime()) ? { createdAt: { $lt: cursor } } : {};
  return { limit, cursorFilter };
};

export const nextCursorFrom = (items: ReadonlyArray<{ createdAt?: Date | string }>): string | null => {
  const last = items[items.length - 1];
  if (!last) return null;
  return last.createdAt ? new Date(last.createdAt).toISOString() : null;
};
